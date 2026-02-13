import type {
    CreateAgentRequest,
    MultiplexClientMessage,
    MultiplexDataMessage,
    MultiplexInvokeMessage,
    MultiplexMessage,
    PromptTemplate,
} from './types';

import { Chunk, Usage, makeRole } from '@agentica/common';
import { printModelNotice } from '@agentica/model-notices';
import { type ScopedLogger, createLogger, loggingConfig } from '@logging/index';
import { v4 as uuidv4 } from 'uuid';

// Use native WebSocket in browser, 'ws' package in Node.js
type WebSocketLike = {
    binaryType: string;
    readyState: number;
    onopen: ((event: any) => void) | null;
    onmessage: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onclose: ((event: any) => void) | null;
    send: (data: any) => void;
    close: (code?: number, reason?: string) => void;
};

async function createWebSocket(
    url: string,
    apiKey: string | null,
    customHeaders?: Record<string, string>
): Promise<WebSocketLike> {
    // Check for Node.js environment and ws package
    if (typeof process !== 'undefined' && process.versions?.node) {
        const WS = await import('ws').then((m) => m.default || m);

        const headers: Record<string, string> = { ...customHeaders };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        return new WS(url, { headers });
    }

    // Browser environment - native WebSocket (doesn't support custom headers)
    // Note: traceparent would need to be sent via query params or other mechanism in browser
    if (apiKey) {
        const separator = url.includes('?') ? '&' : '?';
        const authenticatedUrl = `${url}${separator}bearer=${encodeURIComponent(apiKey)}`;
        return new WebSocket(authenticatedUrl) as any;
    }
    return new WebSocket(url) as any;
}

import { registerCleanup } from './at-exit';
import { decodeMessage, encodeMessage, isServerMessage, uint8ArrayToBase64 } from './message-utils';
import { Queue } from './queue';

/**
 * Encapsulates per-session-manager WebSocket connection state.
 */
interface SessionManagerConnection {
    websocket: WebSocketLike;
    sendQueue: Queue<MultiplexClientMessage>;
    tasks: [TaskControl, TaskControl]; // [reader, writer]
}

import {
    ConnectionError,
    SDKUnsupportedError,
    ServerError,
    WebSocketConnectionError,
    attemptToParseMultiplexError,
    enrichError,
} from '@/errors';
import { waitForTracing } from '@/index';
import { injectTraceContext } from '@/otel-config';
import { CustomLogFW } from '@/otel-logging';
import { version } from '@/version';

/**
 * Configuration options for ClientSessionManager
 */
export interface ClientSessionManagerConfig {
    /** API key for authentication (optional) */
    apiKey?: string | null;
    /** Enable OpenTelemetry logging to send logs to session manager's collector */
    enableOtelLogging?: boolean;
}

/* AgentInvocationHandle interface */
export interface AgentInvocationHandle {
    send_message: (data: Uint8Array) => Promise<void>;
    recv_message: () => Promise<Uint8Array>;
    exception: Promise<void>;
    iid: string;
}

/* Parameters for invokeAgent method */
export interface InvokeAgentParams {
    uid: string;
    warpLocalsPayload: Uint8Array;
    taskDesc: string | PromptTemplate;
    streaming: boolean;
    parentUid?: string;
    parentIid?: string;
}

/**
 * Background task control
 */
interface TaskControl {
    shouldStop: boolean;
    promise: Promise<void>;
}

/**
 * ClientSessionManager - TypeScript equivalent of the Python ClientSessionManager
 * Maintains identical structure and method signatures
 */
export class ClientSessionManager {
    // Per-session-manager WebSocket state (sm_id → connection state)
    private sessionManagers: Map<string, SessionManagerConnection> = new Map();
    private smLocks: Map<string, Promise<void>> = new Map();
    private uidToSm: Map<string, string> = new Map(); // agent uid → sm_id

    private uidIidRecvQueue: Map<string, Map<string, Queue<Uint8Array>>>;
    private uidIidException: Map<
        string,
        Map<string, { resolve: () => void; reject: (reason?: any) => void; promise: Promise<void> }>
    >;
    private matchIid: Map<string, { resolve: (value: string) => void; reject: (reason?: any) => void }>;
    private iidToUid: Map<string, string>;
    private knownUids: Set<string>;

    private baseHttp: string | null = null;
    private baseWs: string | null = null;
    private apiKey: string | null = null;
    private idIssuer: () => string;
    private uidToLogger: Map<string, ScopedLogger> = new Map();
    private isStopped: boolean = false;
    private isStopping: boolean = false;
    private logger: ScopedLogger;
    private sessionSpan: ReturnType<ScopedLogger['startSpan']> | null = null;

    // Session management
    private clientSessionId: string;

    // Invocation guard: keeps process alive only during active WebSocket connections
    private activeConnectionCount: number = 0;
    private invocationGuard: ReturnType<typeof setInterval> | null = null;

    constructor(config: ClientSessionManagerConfig = {}) {
        this.logger = createLogger('session-manager');
        this.idIssuer = () => uuidv4();
        this.uidIidRecvQueue = new Map();
        this.uidIidException = new Map();
        this.matchIid = new Map();
        this.iidToUid = new Map();
        this.knownUids = new Set();
        this.apiKey = config.apiKey ?? null;

        // Initialize session management
        this.clientSessionId = uuidv4();

        // Start session-level span for entire SDK lifetime
        this.sessionSpan = this.logger.startSpan('sdk.session');
        this.sessionSpan.setAttribute('sdk.version', version);
        this.sessionSpan.setAttribute('sdk.session_id', this.clientSessionId);

        // Initialize OpenTelemetry logging (optional) - sends logs to session manager's collector
        if (config.enableOtelLogging || loggingConfig.isOtelLoggingEnabled()) {
            const instanceId = `sdk-${this.idIssuer().slice(0, 8)}`;

            const logFW = new CustomLogFW('agentica-sdk-typescript', instanceId);
            logFW.setupLogging();

            this.logger.info(`OpenTelemetry logging initialized for SDK instance: ${instanceId}`);

            if (this.sessionSpan) {
                this.sessionSpan.setAttribute('sdk.instance_id', instanceId);
            }
        }

        // Cleanup registration happens in setEndpoints() when CSM is actually configured

        this.logger.info(`Initialized ClientSessionManager with session ID: ${this.clientSessionId}`);
    }

    /**
     * Increment active connection count and create guard if needed.
     * The guard is a ref'd interval that keeps the process alive during active connections.
     */
    private refConnection(): void {
        this.activeConnectionCount++;
        if (this.activeConnectionCount === 1 && !this.invocationGuard) {
            // Create a dummy interval that keeps the process alive
            this.invocationGuard = setInterval(() => {}, 2147483647); // Max safe interval
        }
    }

    /**
     * Decrement active connection count and clear guard if no more connections.
     */
    private unrefConnection(): void {
        this.activeConnectionCount = Math.max(0, this.activeConnectionCount - 1);
        if (this.activeConnectionCount === 0 && this.invocationGuard) {
            clearInterval(this.invocationGuard);
            this.invocationGuard = null;
        }
    }

    setEndpoints(baseHttp: string, baseWs: string): void {
        this.baseHttp = baseHttp;
        this.baseWs = baseWs;
        if (this.sessionSpan) {
            this.sessionSpan.setAttribute('sdk.base_url', baseHttp);
        }
        this.logger.debug(`Endpoints set (http=${baseHttp}, ws=${baseWs})`);

        // Register for cleanup only when first configured
        registerCleanup(this, () => this.close());

        // Register session with server
        this.registerSession().catch((error) => {
            this.logger.error('Fatal error during session registration:', error);
            throw error;
        });
    }

    /**
     * Register this client session with the server.
     * Throws an error if registration fails.
     */
    private async registerSession(): Promise<void> {
        await waitForTracing;

        if (!this.baseHttp) {
            const error = new ConnectionError('Cannot register session: baseHttp not set');
            enrichError(error, { sessionId: this.clientSessionId });
            throw error;
        }

        try {
            const response = await fetch(`${this.baseHttp}/session/register`, {
                method: 'POST',
                headers: this.buildHeaders(),
            });

            if (response.ok) {
                this.logger.info(`Session ${this.clientSessionId} registered with server`);
            } else {
                const responseText = await response.text().catch(() => 'unknown error');
                const error = new ConnectionError(
                    `Failed to register session: HTTP ${response.status} - ${responseText}`
                );
                enrichError(error, { sessionId: this.clientSessionId });
                throw error;
            }
        } catch (error) {
            if (error instanceof ConnectionError) {
                throw error;
            }
            const enrichedError = new ConnectionError(
                `Failed to register session: ${error instanceof Error ? error.message : 'unknown error'}`
            );
            enrichError(enrichedError, { sessionId: this.clientSessionId });
            throw enrichedError;
        }
    }

    /**
     * Build authentication headers for HTTP requests.
     */
    private buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
        const headers: Record<string, string> = additionalHeaders || {};
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        headers['X-Client-Session-ID'] = this.clientSessionId;
        return headers;
    }

    /**
     * Background task for writing messages to WebSocket for a specific session manager.
     */
    private async smWriter(smId: string, control: TaskControl): Promise<void> {
        await waitForTracing;

        const wsLogger = this.logger.withScope(`ws-writer-${smId.slice(0, 8)}`);
        wsLogger.debug('Writer task started');

        try {
            while (!control.shouldStop) {
                const smc = this.sessionManagers.get(smId);
                if (!smc) {
                    wsLogger.debug('Session manager connection removed, exiting writer');
                    break;
                }

                try {
                    const msg = await smc.sendQueue.get();
                    const msgUid = (msg as any).uid as string | undefined;
                    const msgLogger = msgUid ? (this.uidToLogger.get(msgUid) ?? wsLogger) : wsLogger;

                    if (smc.websocket.readyState !== 1) {
                        const error = new WebSocketConnectionError(`cannot send as websocket is not open.`);
                        enrichError(error, { uid: msgUid, sessionId: this.clientSessionId });
                        throw error;
                    }

                    msgLogger.debug(`Sending ${msg.type} message`);
                    smc.websocket.send(encodeMessage(msg));
                } catch (error) {
                    if (error instanceof Error && error.message === 'Queue closed') {
                        wsLogger.debug('Queue closed, exiting writer');
                        break;
                    }
                    throw error;
                }
            }
            wsLogger.debug('Writer task stopped');
        } catch (error) {
            wsLogger.error('Writer task failed', error as Error);
            // Clean up this session manager only - don't affect others
            await this._cleanupSessionManager(smId);
            throw error;
        }
    }

    /**
     * Background task for reading messages from WebSocket for a specific session manager.
     */
    private async smReader(smId: string, control: TaskControl): Promise<void> {
        await waitForTracing;

        const wsLogger = this.logger.withScope(`ws-reader-${smId.slice(0, 8)}`);
        wsLogger.debug('Reader task started');

        const smc = this.sessionManagers.get(smId);
        if (!smc) {
            wsLogger.warn('Session manager connection not found');
            return;
        }
        const ws = smc.websocket;

        ws.onmessage = (event) => {
            if (control.shouldStop) return;

            let msg_bytes: Uint8Array;

            // Check for Buffer in Node.js environment
            if (typeof Buffer !== 'undefined' && event.data instanceof Buffer) {
                msg_bytes = new Uint8Array(event.data);
            } else if (event.data instanceof ArrayBuffer) {
                msg_bytes = new Uint8Array(event.data);
            } else if (event.data instanceof Uint8Array) {
                msg_bytes = event.data;
            } else {
                wsLogger.warn(`Unexpected WebSocket data type: ${typeof event.data}`);
                return;
            }

            let msg: MultiplexMessage;
            try {
                msg = decodeMessage(msg_bytes);
            } catch (error) {
                wsLogger.warn('Failed to decode message', error as Error);
                return;
            }

            wsLogger.debug(`Received ${msg.type} message (${msg_bytes.length} bytes)`);

            if (!isServerMessage(msg)) {
                wsLogger.debug(`Message is not a server message: ${msg.type}`);
                wsLogger.debugObject('Message', msg);
                return;
            }
            switch (msg.type) {
                case 'new_iid': {
                    wsLogger.debug(`New IID message for match_id=${msg.match_id} uid=${msg.uid} iid=${msg.iid}`);
                    const promise = this.matchIid.get(msg.match_id);
                    if (promise) {
                        promise.resolve(msg.iid);
                        this.matchIid.delete(msg.match_id);
                        wsLogger.debug(`Matched IID ${msg.iid} for match_id=${msg.match_id}`);
                    }
                    break;
                }
                case 'data': {
                    const uid = msg.uid;
                    const msgLogger = this.uidToLogger.get(uid) ?? wsLogger;
                    msgLogger.debug(`Data message for iid=${msg.iid} (${(msg.data as Uint8Array).length} bytes)`);
                    const recvQueue = this.uidIidRecvQueue.get(uid)?.get(msg.iid);
                    if (recvQueue) {
                        recvQueue.put(msg.data as Uint8Array);
                        msgLogger.debug(`Queued data for iid=${msg.iid} (${(msg.data as Uint8Array).length} bytes)`);
                    }
                    break;
                }
                case 'invocation': {
                    const uid = msg.uid;
                    const msgLogger = this.uidToLogger.get(uid) ?? wsLogger;
                    msgLogger.debug(`Invocation message: ${msg.event}`);
                    const recvQueue = this.uidIidRecvQueue.get(uid)?.get(msg.iid);
                    const exceptionMap = this.uidIidException.get(uid);
                    if (msg.event === 'ERROR') {
                        if (exceptionMap && exceptionMap.has(msg.iid)) {
                            const resolver = exceptionMap.get(msg.iid)!;
                            exceptionMap.delete(msg.iid);
                            resolver.reject(new ServerError(`Error event for iid=${msg.iid}`));
                        }
                        if (recvQueue) {
                            recvQueue.put(new Uint8Array([0]));
                        }
                    }
                    if (msg.event === 'EXIT') {
                        msgLogger.debug(`Invocation exit for iid=${msg.iid}`);
                        if (exceptionMap && exceptionMap.has(msg.iid)) {
                            exceptionMap.delete(msg.iid);
                        }
                    }
                    break;
                }
                case 'error': {
                    const uid = msg.uid;
                    const msgLogger = uid ? (this.uidToLogger.get(uid) ?? wsLogger) : wsLogger;
                    msgLogger.debug(`Error message for iid=${msg.iid}`);
                    const exceptionMap = uid ? this.uidIidException.get(uid) : undefined;
                    const error = attemptToParseMultiplexError(msg);
                    if (exceptionMap && exceptionMap.has(msg.iid)) {
                        const resolver = exceptionMap.get(msg.iid)!;
                        exceptionMap.delete(msg.iid);
                        resolver.reject(error);
                    }
                    break;
                }
                default: {
                    wsLogger.debug(`Unknown message: ${msg}`);
                    break;
                }
            }
        };

        return new Promise<void>((resolve) => {
            ws.onclose = (event) => {
                wsLogger.debug(`WebSocket closed (code=${event.code}, reason=${event.reason || 'none'})`);
                control.shouldStop = true;

                // Only fail futures for agents on THIS session manager
                this._failSmFutures(smId, `WebSocket closed: ${event.reason || 'Connection closed'}`);
                resolve();
            };
            ws.onerror = (_error) => {
                wsLogger.error('WebSocket error');
                control.shouldStop = true;

                // Only fail futures for agents on THIS session manager
                this._failSmFutures(smId, 'WebSocket error occurred');
                resolve();
            };
        });
    }

    /**
     * Fail pending futures for agents on a specific session manager.
     */
    private _failSmFutures(smId: string, reason: string): void {
        // Get all UIDs that belong to this session manager
        const affectedUids: string[] = [];
        for (const [uid, sid] of this.uidToSm.entries()) {
            if (sid === smId) {
                affectedUids.push(uid);
            }
        }

        // Fail matchIid promises for affected UIDs (we don't track which session manager a match_id belongs to,
        // so we fail all of them when any session manager fails - this is conservative but safe)
        for (const [matchId, handlers] of this.matchIid.entries()) {
            handlers.reject(new WebSocketConnectionError(reason));
            this.matchIid.delete(matchId);
        }

        // Fail exception handlers for affected UIDs
        for (const uid of affectedUids) {
            const exceptionMap = this.uidIidException.get(uid);
            if (exceptionMap) {
                for (const [_iid, handlers] of exceptionMap.entries()) {
                    handlers.reject(new WebSocketConnectionError(reason));
                }
                exceptionMap.clear();
            }
        }
    }

    /**
     * Clean up a specific session manager's connection without affecting others.
     */
    private async _cleanupSessionManager(smId: string): Promise<void> {
        const smc = this.sessionManagers.get(smId);
        if (!smc) {
            return;
        }

        this.logger.debug(`Cleaning up session manager ${smId.slice(0, 8)}`);
        this.sessionManagers.delete(smId);
        this.smLocks.delete(smId);

        // Stop tasks
        const [readerControl, writerControl] = smc.tasks;
        readerControl.shouldStop = true;
        writerControl.shouldStop = true;

        // Close send queue
        smc.sendQueue.close();

        // Close WebSocket gracefully
        try {
            if (smc.websocket.readyState === 0 || smc.websocket.readyState === 1) {
                smc.websocket.close(1000, 'Normal closure');
            }
        } catch (error) {
            this.logger.warn(`Failed to close WebSocket for session manager ${smId.slice(0, 8)}`, error as Error);
        }

        // Wait for tasks to complete
        await Promise.allSettled([readerControl.promise, writerControl.promise]);

        // Fail pending futures for agents on this session manager
        this._failSmFutures(smId, 'Session manager connection closed');

        // Clean up agent-to-session-manager mappings
        const affectedUids: string[] = [];
        for (const [uid, sid] of this.uidToSm.entries()) {
            if (sid === smId) {
                affectedUids.push(uid);
            }
        }
        for (const uid of affectedUids) {
            this.uidToSm.delete(uid);
        }

        this.logger.debug(`Cleaned up session manager ${smId.slice(0, 8)}`);
    }

    /**
     * Ensure WebSocket connection exists for a specific session manager, creating it if needed.
     */
    private async _ensureSmConnection(smId: string): Promise<void> {
        // Fast path: connection already exists
        const existing = this.sessionManagers.get(smId);
        if (existing && existing.websocket.readyState === 1) {
            return;
        }

        // Check if another call is already creating this connection
        const existingLock = this.smLocks.get(smId);
        if (existingLock) {
            await existingLock;
            return;
        }

        // Create lock IMMEDIATELY after check - no await between check and set
        let resolveLock: () => void;
        const lockPromise = new Promise<void>((resolve) => {
            resolveLock = resolve;
        });
        this.smLocks.set(smId, lockPromise);

        // Now safe to yield
        await waitForTracing;

        const span = this.logger.startSpan('sdk.sm_connection');
        span.setAttribute('session_manager.id', smId);

        try {
            // Double-check after acquiring lock
            const doubleCheck = this.sessionManagers.get(smId);
            if (doubleCheck && doubleCheck.websocket.readyState === 1) {
                resolveLock!();
                this.smLocks.delete(smId);
                return;
            }

            const sendQueue = new Queue<MultiplexClientMessage>();
            const websocket_uri = `${this.baseWs}/socket`;
            this.logger.debug(`Connecting WebSocket for session manager ${smId.slice(0, 8)}`);
            span.setAttribute('websocket.uri', websocket_uri);
            span.setAttribute('websocket.state', 'connecting');

            // Create headers object with trace context for distributed tracing
            const headers: Record<string, string> = {};
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }
            headers['x-client-session-id'] = this.clientSessionId;

            // Inject trace context into WebSocket headers for distributed tracing
            if (span.executeInContext) {
                span.executeInContext(() => {
                    injectTraceContext(headers);
                });
            } else {
                injectTraceContext(headers, span);
            }

            const ws = await createWebSocket(websocket_uri, this.apiKey, headers);
            ws.binaryType = 'arraybuffer';

            return new Promise<void>((resolve, reject) => {
                ws.onopen = () => {
                    try {
                        (ws as any)._socket?.unref?.();
                    } catch {
                        // Ignore unref errors
                    }

                    const readerControl: TaskControl = {
                        shouldStop: false,
                        promise: Promise.resolve(),
                    };
                    const writerControl: TaskControl = {
                        shouldStop: false,
                        promise: Promise.resolve(),
                    };

                    // Store the session manager connection first so tasks can access it
                    const smc: SessionManagerConnection = {
                        websocket: ws,
                        sendQueue,
                        tasks: [readerControl, writerControl],
                    };
                    this.sessionManagers.set(smId, smc);

                    // Start per-session-manager reader and writer tasks
                    readerControl.promise = this.smReader(smId, readerControl).catch((error) => {
                        this.logger.error(
                            `Reader task crashed for session manager ${smId.slice(0, 8)}`,
                            error as Error
                        );
                    });
                    writerControl.promise = this.smWriter(smId, writerControl).catch((error) => {
                        this.logger.error(
                            `Writer task crashed for session manager ${smId.slice(0, 8)}`,
                            error as Error
                        );
                    });

                    this.logger.info(`WebSocket connected for session manager ${smId.slice(0, 8)}`);
                    span.setAttribute('websocket.state', 'connected');
                    span.end();
                    resolveLock();
                    this.smLocks.delete(smId);
                    resolve();
                };

                ws.onerror = (error) => {
                    this.logger.error(
                        `WebSocket connection failed for session manager ${smId.slice(0, 8)}:\n${error.toString()}`
                    );
                    span.setAttribute('websocket.state', 'error');
                    span.recordException(error as Error);
                    span.end();
                    resolveLock();
                    this.smLocks.delete(smId);
                    reject(new WebSocketConnectionError('WebSocket connection failed'));
                };
            });
        } catch (error) {
            span.setAttribute('websocket.state', 'error');
            span.recordException(error as Error);
            span.end();
            resolveLock!();
            this.smLocks.delete(smId);
            throw error;
        }
    }

    /**
     * Initialize per-agent data structures.
     */
    private _initAgentState(uid: string, parentLogger?: ScopedLogger): void {
        if (!this.uidIidRecvQueue.has(uid)) {
            this.uidIidRecvQueue.set(uid, new Map());
        }
        if (!this.uidIidException.has(uid)) {
            this.uidIidException.set(uid, new Map());
        }
        if (parentLogger) {
            this.uidToLogger.set(uid, parentLogger);
        }
    }

    /**
     * Create new agent - matches Python new_agent
     */
    async newAgent(cmar: CreateAgentRequest, parentLogger?: ScopedLogger): Promise<string> {
        await waitForTracing;

        this.refConnection();

        const logger = parentLogger ?? this.logger;
        const span = logger.startSpan('sdk.new_agent');
        try {
            // Wait if currently stopping
            while (this.isStopping) {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }

            // Restart if stopped
            if (this.isStopped) {
                this.isStopped = false;
            }

            if (!this.baseHttp || !this.baseWs) {
                logger.error('Endpoints not set');
                const error = new ConnectionError('Base HTTP and WS endpoints must be set');
                enrichError(error, { sessionId: this.clientSessionId });
                throw error;
            }

            cmar.protocol = `typescript/${version}`;
            const uri = `${this.baseHttp}/agent/create`;
            logger.debug(`Creating agent (model=${cmar.model})`);

            if (cmar.model) {
                printModelNotice(cmar.model);
            }

            span.setAttribute('agent.model', cmar.model || 'unknown');
            span.setAttribute('agent.streaming', cmar.streaming || false);

            const requestBody = {
                ...cmar,
                warp_globals_payload: uint8ArrayToBase64(cmar.warp_globals_payload),
            };

            // Build headers with trace context for distributed tracing
            const headers = this.buildHeaders({ 'Content-Type': 'application/json' });
            injectTraceContext(headers, span);

            const response = await fetch(uri, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
            });

            if (response.status === 426) {
                const errorData = await response.json();
                const detail = errorData?.detail || 'SDK version is no longer supported.';
                const error = new SDKUnsupportedError(detail);
                enrichError(error, { sessionId: this.clientSessionId });
                throw error;
            }

            if (!response.ok) {
                logger.error(`HTTP request failed: ${response.status} ${response.statusText}`);
                const error = new ConnectionError(`HTTP ${response.status}: ${response.statusText}`);
                enrichError(error, { sessionId: this.clientSessionId });
                throw error;
            }

            const warning = response.headers.get('X-SDK-Warning');
            if (warning === 'deprecated') {
                const message = response.headers.get('X-SDK-Upgrade-Message');
                if (message) {
                    logger.warn(message);
                }
            }

            // Parse JSON response: { uid, session_manager_id }
            const responseData = await response.json();
            const uid = responseData.uid as string;
            const smId = responseData.session_manager_id as string;

            // Validate response fields
            if (!uid) {
                logger.error(`Server response missing "uid" field: ${JSON.stringify(responseData)}`);
                throw new ConnectionError('Invalid server response: missing "uid" field');
            }
            if (!smId) {
                logger.error(`Server response missing "session_manager_id" field: ${JSON.stringify(responseData)}`);
                throw new ConnectionError('Invalid server response: missing "session_manager_id" field');
            }

            logger.info('Created agent');
            span.setAttribute('agent.uid', uid);
            span.setAttribute('agent.session_manager_id', smId);

            // Track which session manager this agent belongs to
            this.uidToSm.set(uid, smId);

            // Ensure WebSocket connection for this session manager
            await this._ensureSmConnection(smId);

            this.knownUids.add(uid);
            this._initAgentState(uid, parentLogger);
            return uid;
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Create new agent invocation - matches Python invoke_agent
     */
    async invokeAgent(params: InvokeAgentParams, parentLogger?: ScopedLogger): Promise<AgentInvocationHandle> {
        await waitForTracing;

        this.refConnection();

        const { uid, warpLocalsPayload, taskDesc, streaming } = params;
        const logger = parentLogger ?? this.logger;
        const span = logger.startSpan('sdk.invoke_agent');
        const invLogger = logger.withScope('inv');

        try {
            if (this.isStopping) {
                logger.error('Cannot invoke agent: session manager is stopping');
                const error = new ConnectionError('Session manager is stopping');
                enrichError(error, { uid, sessionId: this.clientSessionId });
                throw error;
            }

            if (!this.baseHttp || !this.baseWs) {
                logger.error('Endpoints not set');
                const error = new ConnectionError('Base HTTP and WS endpoints must be set');
                enrichError(error, { uid, sessionId: this.clientSessionId });
                throw error;
            }

            // Get session manager for this agent
            const smId = this.uidToSm.get(uid);
            if (!smId) {
                const error = new WebSocketConnectionError(`No session manager found for agent ${uid}`);
                enrichError(error, { uid, sessionId: this.clientSessionId });
                throw error;
            }

            const smc = this.sessionManagers.get(smId);
            if (!smc || smc.websocket.readyState !== 1) {
                const error = new WebSocketConnectionError(`No active connection for session manager ${smId}`);
                enrichError(error, { uid, sessionId: this.clientSessionId });
                throw error;
            }

            // Add attributes matching Python SDK
            span.setAttribute('agent.uid', uid);
            span.setAttribute('agent.session_manager_id', smId);
            span.setAttribute('agent.task_desc', typeof taskDesc === 'string' ? taskDesc : taskDesc.template);
            span.setAttribute('invocation.streaming', streaming);

            const matchId = this.idIssuer();
            const msg: MultiplexInvokeMessage = {
                type: 'invoke',
                match_id: matchId,
                uid: uid,
                warp_locals_payload: warpLocalsPayload,
                timestamp: new Date().toISOString(),
                prompt: taskDesc,
                streaming: streaming,
            };

            invLogger.debug(`Invoking with match_id=${matchId} on session manager ${smId.slice(0, 8)}`);

            const iidPromise = new Promise<string>((resolve, reject) => {
                this.matchIid.set(matchId, { resolve, reject });
            });

            // Route to the correct session manager's send queue
            smc.sendQueue.put(msg);

            const iid = await iidPromise;
            this.iidToUid.set(iid, uid);
            invLogger.info(`Invocation created with iid=${iid}`);
            span.setAttribute('invocation.iid', iid);

            this.uidIidRecvQueue.get(uid)!.set(iid, new Queue());
            const recvQueue = this.uidIidRecvQueue.get(uid)!.get(iid)!;
            const { resolvers, promise: exceptionPromise } = (() => {
                let resolve!: () => void;
                let reject!: (reason?: any) => void;
                const promise = new Promise<void>((res, rej) => {
                    resolve = res;
                    reject = rej;
                });
                return { resolvers: { resolve, reject, promise }, promise };
            })();
            this.uidIidException.get(uid)!.set(iid, resolvers);

            // Capture smId for the closure
            const capturedSmId = smId;

            return <AgentInvocationHandle>{
                send_message: async (data: Uint8Array) => {
                    const currentSmc = this.sessionManagers.get(capturedSmId);
                    if (!currentSmc || currentSmc.websocket.readyState !== 1) {
                        throw new WebSocketConnectionError(`Session manager connection closed for ${capturedSmId}`);
                    }
                    const dataMsg: MultiplexDataMessage = {
                        type: 'data',
                        uid,
                        iid,
                        data,
                        timestamp: new Date().toISOString(),
                    };
                    currentSmc.sendQueue.put(dataMsg);
                    invLogger.debug(`Queued ${data.length} bytes to send`);
                },
                recv_message: async (): Promise<Uint8Array> => {
                    const data = await recvQueue.get();
                    invLogger.debug(`Received ${data.length} bytes`);
                    return data;
                },
                exception: exceptionPromise,
                iid,
            };
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
            this.unrefConnection();
        }
    }

    /**
     * Echo streaming endpoint
     */
    async *echo(cancelSignal: AbortSignal, uid: string, iid?: string, includeUsage: boolean = false): AsyncGenerator<Chunk, void, unknown> {
        if (!this.baseHttp) {
            const error = new ConnectionError('Base HTTP endpoint must be set');
            enrichError(error, { uid, iid, sessionId: this.clientSessionId });
            throw error;
        }

        const endpoint = `/echo/${uid}${iid ? `/${iid}` : ''}`;
        const url = `${this.baseHttp}${endpoint}`;

        this.logger.debug(`Starting echo stream for ${uid}${iid ? `/${iid}` : ''}`);

        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        let response: Response | null = null;
        const abortController = new AbortController();

        try {
            response = await fetch(url, {
                method: 'GET',
                headers: this.buildHeaders({ Accept: 'text/event-stream' }),
                signal: AbortSignal.any([abortController.signal, cancelSignal]),
                bodyTimeout: 0, // Node.js only
            } as RequestInit);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                const error = new ServerError(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                enrichError(error, { uid, iid, sessionId: this.clientSessionId });
                throw error;
            }

            if (!response.body) {
                const error = new ServerError('Response body is null - server may not support streaming');
                enrichError(error, { uid, iid, sessionId: this.clientSessionId });
                throw error;
            }

            reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let chunkCount = 0;
            const maxChunks = 10_000; // Prevent infinite loops
            const maxBufferSize = 1024 * 1024; // 1MB buffer limit
            let isStreaming = false;

            try {
                while (chunkCount < maxChunks) {
                    const { done, value } = await reader.read();

                    if (done) {
                        this.logger.debug(`Echo stream completed normally after ${chunkCount} chunks`);
                        break;
                    }

                    // Prevent buffer overflow
                    if (buffer.length > maxBufferSize) {
                        this.logger.warn('Buffer size exceeded, clearing buffer');
                        buffer = '';
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.trim()) {
                            continue;
                        }

                        try {
                            const logmsg = JSON.parse(line);
                            const typ = logmsg.type;

                            if (typ === 'sm_invocation_exit') {
                                // Only return if listening to a specific invocation.
                                // When iid is undefined, we're listening to all invocations
                                // for this agent and should continue across invocations.
                                if (iid !== undefined) {
                                    this.logger.debug('Received invocation exit signal, ending stream');
                                    return;
                                }
                                yield { role: 'agent', content: '', type: 'invocation_exit' };
                                isStreaming = false;
                                continue;
                            }

                            if (typ === 'sm_monad' && logmsg.body) {
                                const body = JSON.parse(logmsg.body);

                                if (body.system) continue;

                                if (body.type === 'stream_chunk') {
                                    isStreaming = true;
                                    const delta = body.args[0];
                                    if (delta && delta.content) {
                                        yield { role: 'agent', content: delta.content, type: delta.type };
                                        chunkCount++;
                                    }
                                } else if (body.type === 'delta') {
                                    const delta = body.args[0];
                                    if (delta && delta.content) {
                                        const role = makeRole(delta.role, delta.username);

                                        if (role === 'system') {
                                            // Skip system messages
                                            continue;
                                        } else if (isStreaming && role === 'agent' && delta.type !== 'usage') {
                                            // Skip agent messages as they're already handled in stream_chunk,
                                            // except usage chunks which are only sent via delta
                                            continue;
                                        }

                                        if (delta.type === 'usage' && !includeUsage) {
                                            continue;
                                        }

                                        yield { role, content: delta.content, type: delta.type };
                                        chunkCount++;
                                    }
                                }
                            }
                        } catch (parseError) {
                            this.logger.warn('Failed to parse echo line', parseError as Error);
                            // Continue processing other lines instead of failing completely
                        }
                    }
                }

                if (chunkCount >= maxChunks) {
                    this.logger.warn(`Echo stream stopped after ${maxChunks} chunks (safety limit)`);
                }
            } finally {
                if (reader) {
                    try {
                        reader.releaseLock();
                    } catch (releaseError) {
                        this.logger.warn('Failed to release reader lock', releaseError as Error);
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError' && cancelSignal.aborted) {
                // this is expected after result was received
                this.logger.debug('Echo stream aborted by caller');
                return;
            }

            this.logger.error('Echo stream error', error as Error);

            // Provide more specific error information
            if (error instanceof TypeError && error.message.includes('fetch')) {
                const enrichedError = new ConnectionError(`Network error during echo stream: ${error.message}`);
                enrichError(enrichedError, { uid, iid, sessionId: this.clientSessionId });
                throw enrichedError;
            } else if (error instanceof Error && error.message.includes('HTTP')) {
                const enrichedError = new ServerError(`Server error during echo stream: ${error.message}`);
                enrichError(enrichedError, { uid, iid, sessionId: this.clientSessionId });
                throw enrichedError;
            } else {
                const enrichedError = new ServerError(
                    `Echo stream failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
                enrichError(enrichedError, { uid, iid, sessionId: this.clientSessionId });
                throw enrichedError;
            }
        } finally {
            // Abort the fetch request to close the underlying socket
            try {
                abortController.abort();
            } catch {
                // Ignore abort errors
            }

            // Ensure cleanup even if an error occurs
            if (reader) {
                try {
                    reader.releaseLock();
                } catch {
                    // Ignore cleanup errors
                }
            }
        }
    }

    /**
     * Fetch logs for a specific agent and optionally a specific invocation.
     * Matches Python logs() method.
     */
    async logs(uid: string, iid?: string, params?: Record<string, any>): Promise<Array<Record<string, any>>> {
        if (!this.baseHttp) {
            throw new ConnectionError('Base HTTP endpoint must be set');
        }

        let endpoint = `/logs/${uid}`;
        if (iid) {
            endpoint += `/${iid}`;
        }

        const url = new URL(`${this.baseHttp}${endpoint}`);
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                url.searchParams.append(key, String(value));
            }
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: this.buildHeaders(),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new ServerError(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        return response.json();
    }

    /**
     * Fetch and calculate usage for a specific invocation.
     * Handles chat-completions API's cumulative token reporting by subtracting previous totals.
     *
     * @param uid - Agent UID
     * @param iid - Invocation ID
     * @param lastTotal - Previous cumulative total (for cross-invocation adjustment)
     * @returns Object containing the usage for this invocation and the new cumulative total
     */
    async fetchUsage(uid: string, iid: string, _lastTotal?: Usage): Promise<{ usage: Usage; newTotal: Usage }> {
        // Fetch logs for this invocation and sum usages
        // Each log entry contains non-cumulative usage values, so we just add them up
        // The logs are already filtered by iid, so they only contain this invocation's data
        let total = Usage.zero();
        const logs = await this.logs(uid, iid, { type: 'sm_inference_usage' });

        for (const log of logs) {
            const logUsage = log.usage as Record<string, unknown>;
            if (logUsage) {
                // Don't pass lastUsage - each log entry is already non-cumulative
                total = total.add(Usage.fromCompletions(logUsage));
            }
        }

        return { usage: total, newTotal: total };
    }

    /**
     * Check if agent exists - matches Python agent_exists
     */
    agentExists(uid: string): boolean {
        if (!this.knownUids.has(uid)) {
            return false;
        }
        const smId = this.uidToSm.get(uid);
        if (!smId) {
            return false;
        }
        const smc = this.sessionManagers.get(smId);
        return smc !== undefined && smc.websocket.readyState === 1; // 1 = OPEN
    }

    /**
     * Get uid from iid (used for parent-child agent tracking)
     */
    getUidForIid(iid: string): string | undefined {
        return this.iidToUid.get(iid);
    }

    /**
     * Destroy an agent on the server
     */
    async destroyAgent(uid: string): Promise<void> {
        if (!this.baseHttp) {
            this.logger.warn('Cannot destroy agent: baseHttp not set');
            return;
        }

        const span = this.logger.startSpan('sdk.destroy_agent');
        span.setAttribute('agent.uid', uid);

        try {
            const uri = `${this.baseHttp}/agent/destroy/${uid}`;
            this.logger.debug(`Destroying agent ${uid.slice(0, 8)}`);

            const response = await fetch(uri, {
                method: 'DELETE',
                headers: this.buildHeaders(),
            });

            if (response.ok) {
                this.logger.debug(`Destroyed agent ${uid.slice(0, 8)}`);
            } else {
                this.logger.info(`Failed to destroy agent: HTTP ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            this.logger.debug(
                `Failed to destroy agent ${uid.slice(0, 8)} (server may be down): ${(error as Error).message}`
            );
            span.recordException(error as Error);
        } finally {
            span.end();
        }
    }

    /**
     * Close a specific agent's resources (does not close the session manager's WebSocket unless it's the last agent)
     */
    async closeAgent(uid: string): Promise<void> {
        const logger = this.uidToLogger.get(uid) ?? this.logger;
        logger.debug(`Closing agent ${uid.slice(0, 8)}`);

        // Close receive queues for this uid
        const recvMap = this.uidIidRecvQueue.get(uid);
        if (recvMap) {
            for (const queue of recvMap.values()) {
                queue.close();
            }
        }

        // Clean up iidToUid entries for this uid
        for (const [iid, mappedUid] of this.iidToUid.entries()) {
            if (mappedUid === uid) {
                this.iidToUid.delete(iid);
            }
        }

        // Clean up per-agent maps
        this.uidIidRecvQueue.delete(uid);
        this.uidIidException.delete(uid);
        this.knownUids.delete(uid);
        this.uidToLogger.delete(uid);
        this.uidToSm.delete(uid);

        logger.debug(`Closed agent ${uid.slice(0, 8)}`);

        // Finally, destroy the agent on the server
        await this.destroyAgent(uid);

        this.unrefConnection();
    }

    /**
     * Stop all connections and cleanup resources
     */
    async stop(): Promise<void> {
        if (this.isStopping || this.isStopped) return;
        this.isStopping = true;
        const span = this.logger.startSpan('stop');

        try {
            const agentCount = this.knownUids.size;
            const smCount = this.sessionManagers.size;
            this.logger.debug(`CSM Stop: stopping with ${agentCount} agent(s) on ${smCount} session manager(s)`);
            span.setAttribute('agent_count', agentCount);
            span.setAttribute('session_manager_count', smCount);

            // Close all agents (cleans up per-agent state and destroys on server)
            const uids = Array.from(this.knownUids);
            await Promise.allSettled(uids.map((uid) => this.closeAgent(uid)));

            // Clean up all session manager connections
            const smIds = Array.from(this.sessionManagers.keys());
            await Promise.allSettled(smIds.map((smId) => this._cleanupSessionManager(smId)));

            this.logger.debug('All resources cleaned up');
            this.isStopped = true;

            // Ensure invocation guard is cleared
            if (this.invocationGuard) {
                clearInterval(this.invocationGuard);
                this.invocationGuard = null;
            }
            this.activeConnectionCount = 0;

            // End session span when closing the entire ClientSessionManager
            if (this.sessionSpan) {
                this.sessionSpan.setAttribute('sdk.agents_created', agentCount);
                this.sessionSpan.end();
                this.sessionSpan = null;
                this.logger.debug('Ended session span');
            }
        } finally {
            this.isStopping = false;
            span.end();
        }
    }

    /**
     * Close all connections and cleanup resources
     */
    async close(): Promise<void> {
        return this.stop();
    }
}

declare global {
    var __AGENTICA_AGENTIC_MANAGER: ClientSessionManager | undefined;
}

const __globalScope = globalThis as any;
export const __AGENTIC_MANAGER: ClientSessionManager =
    __globalScope.__AGENTICA_AGENTIC_MANAGER ??
    (__globalScope.__AGENTICA_AGENTIC_MANAGER = new ClientSessionManager({}));

export const __AGENTIC_PROTO_VER = `typescript/${version}`;
