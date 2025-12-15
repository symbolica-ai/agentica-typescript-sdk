import { ClientSessionManager } from '@client-session-manager/client-session-manager';
import { createLogger } from '@logging/index';
import { CompiledConceptContext } from '@transformer/processor/processor-utils';
import { FrameRuntime } from '@warpc/runtime';

import {
    AgentInitializationConfig,
    AgentInvocationConfig,
    Chunk,
    MaxTokens,
    ModelStrings,
    ServeResponseConfig,
    ToolModeStrings,
    Usage,
    createAgentEnvironment,
    invokeAgent,
    serveRequestsUntilResult,
    startEchoStream,
} from './common';
import { type Template, maybePromptTemplate } from './template';

import { Agentica } from '@/agentica-client';

// Re-export Usage for convenience
export { Usage } from './common';

export type AgentSpawnCtx = {
    siteId: string;
    concepts?: CompiledConceptContext;
};

let AGENT_COUNTER = 0;

export type AgentSpawnConfig = {
    model?: ModelStrings;
    premise?: string;
    system?: string | Template;
    listener?: (iid: string, chunk: Chunk) => void;
    maxTokens?: number | MaxTokens;
    client?: Agentica;
};

// System prompt only overload
export async function spawn(
    config: AgentSpawnConfig & { system: string | Template; premise?: never },
    scope?: object
): Promise<Agent>;
// Premise only overload
export async function spawn(
    config: AgentSpawnConfig & { system?: never; premise: string },
    scope?: object
): Promise<Agent>;
// No premise or system overload
export async function spawn(
    config: AgentSpawnConfig & { system?: never; premise?: never },
    scope?: object
): Promise<Agent>;
export async function spawn(config: AgentSpawnConfig, scope?: object): Promise<Agent> {
    void config;
    void scope;
    throw new Error('Run the transformation before calling spawn');
}

export async function spawnTransformation(ctx: AgentSpawnCtx, config: AgentSpawnConfig): Promise<Agent> {
    const agent = new Agent(ctx, config);
    await agent.initialize();
    return agent;
}

export type AgentCallCtx = {
    concepts: CompiledConceptContext;
    siteId: string;
    siteOutputType: string;
    docString: string;
};

export type AgentCallConfig = {
    listener?: (iid: string, chunk: Chunk) => void;
    parentCallId?: string;
};

export class Agent implements AsyncDisposable {
    private uid: string;
    private iid: string | undefined;
    private onCallComplete: (iid: string | undefined) => void;

    private ctx: AgentSpawnCtx;
    private config: AgentSpawnConfig;
    private runtime?: FrameRuntime;
    private sessionManager?: ClientSessionManager;
    private mode: ToolModeStrings;
    private logger: ReturnType<typeof createLogger>;

    // Usage tracking
    private lastIid: string | undefined;
    private lastTotal: Usage | undefined;
    private usages: Map<string, Usage> = new Map();

    constructor(ctx: AgentSpawnCtx, config: AgentSpawnConfig) {
        this.ctx = ctx;
        this.config = config;
        this.mode = 'code';
        this.uid = ''; // set using initialize
        this.iid = undefined; // no call yet
        this.onCallComplete = () => {}; // no-op
        this.logger = createLogger(`agent:${AGENT_COUNTER}`);
        AGENT_COUNTER++;
    }

    async initialize(): Promise<void> {
        const initConfig: AgentInitializationConfig = {
            persist: true,
            streaming: !!this.config.listener,
            model: this.config.model,
            system: maybePromptTemplate(this.config.system),
            premise: this.config.premise,
            siteId: this.ctx.siteId,
            mode: this.mode,
            maxTokens: MaxTokens.fromMaxTokens(this.config.maxTokens),
            concepts: this.ctx.concepts,
            client: this.config.client,
        };
        const { uid, runtime, sessionManager } = await createAgentEnvironment(initConfig, this.logger);
        this.uid = uid;
        this.runtime = runtime;
        this.sessionManager = sessionManager;
        this.logger.debug(`Agent initialized: ${this.uid}`);
    }

    // my_result = myAgent.call("Return the sum of obj1 and obj2", {obj1, obj2})
    // my_result = myAgent.call("Return the sum of obj1 and obj2", {obj1, obj2}, { echo: (iid, chunk) => {...} })
    async call<T>(userPrompt: string | Template, scope?: object, config?: AgentCallConfig): Promise<T> {
        void userPrompt;
        void scope;
        void config;
        throw new Error('Run the transformation before calling call');
    }

    // my_result = myAgent.callPro`Return the sum of ${obj1} and ${obj2}`()
    // my_result = myAgent.callPro`Return the sum of ${obj1} and ${obj2}`(config)
    callPro<T>(userPromptParts: TemplateStringsArray, ...scope: any[]): (config?: AgentCallConfig) => Promise<T> {
        void userPromptParts;
        void scope;
        throw new Error('Run the transformation before calling callPro');
    }

    setOnCallComplete(onCallComplete: (iid: string | undefined) => void): void {
        this.onCallComplete = onCallComplete;
    }

    getUid(): string {
        return this.uid;
    }

    getCurrentCallIid(): string | undefined {
        return this.iid;
    }

    /**
     * Get the usage for the last invocation.
     * @throws Error if no invocation has been made yet or usage not found
     */
    lastUsage(): Usage {
        if (!this.lastIid) {
            throw new Error('No invocation has been made yet');
        }
        const usage = this.usages.get(this.lastIid);
        if (!usage) {
            throw new Error(`Usage not found for invocation ${this.lastIid}`);
        }
        return usage;
    }

    /**
     * Get the total usage across all invocations.
     */
    totalUsage(): Usage {
        let total = Usage.zero();
        for (const usage of this.usages.values()) {
            total = total.add(usage);
        }
        return total;
    }

    /**
     * Manually close the agent and clean up resources
     */
    async close(): Promise<void> {
        if (!this.uid || !this.sessionManager) {
            this.logger.debug('Agent not initialized, nothing to close');
            return;
        }

        this.logger.debug(`Manually closing agent ${this.uid.slice(0, 8)}`);

        // Close local resources
        await this.sessionManager.closeAgent(this.uid);

        // Clear references to help GC
        this.runtime = undefined;
    }

    /**
     * AsyncDisposable implementation for "await using" syntax
     */
    async [Symbol.asyncDispose](): Promise<void> {
        await this.close();
    }

    async callTransformation<T>(ctx: AgentCallCtx, prompt: string | Template, config?: AgentCallConfig): Promise<T> {
        const span = this.logger.startSpan('agentCallTransformation');

        try {
            // Check initialized
            if (!this.uid || !this.runtime || !this.sessionManager) {
                throw new Error('Agent not initialized. Call initialize first!');
            }

            // Invoke agent with call-time concepts (spawn concepts already sent during initialization)
            const invokeConfig: AgentInvocationConfig = {
                uid: this.uid,
                concepts: ctx.concepts,
                siteId: ctx.siteId,
                siteOutputType: ctx.siteOutputType,
                prompt: maybePromptTemplate(prompt),
                streaming: !!config?.listener || !!this.config.listener,
                parentCallId: config?.parentCallId,
            };

            const { handle } = await invokeAgent(
                invokeConfig,
                this.mode,
                this.logger,
                this.sessionManager,
                this.runtime
            );
            this.iid = handle.iid;

            let cancelStream: AbortController | undefined;
            // If echo callback is provided, iterate over stream and call the callback
            if (config?.listener || this.config.listener) {
                cancelStream = new AbortController();
                const echoCallback = config?.listener || this.config.listener; // Prioritize per-site config

                // Start streaming in parallel with serving response
                startEchoStream(
                    this.sessionManager,
                    cancelStream.signal,
                    this.uid,
                    handle.iid,
                    echoCallback!,
                    this.logger
                );
            }

            // Serve response
            const serveConfig: ServeResponseConfig = {
                runtime: this.runtime!,
                handle,
                siteOutputType: ctx.siteOutputType,
            };
            const result = (await Promise.race([
                serveRequestsUntilResult(serveConfig, this.logger),
                handle.exception,
            ])) as T;
            if (cancelStream) {
                cancelStream.abort(); // Cancel the streaming loop after result is returned
            }

            return result;
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            // Fetch usage for this invocation
            if (this.iid && this.sessionManager) {
                try {
                    const { usage, newTotal } = await this.sessionManager.fetchUsage(
                        this.uid,
                        this.iid,
                        this.lastTotal
                    );
                    this.usages.set(this.iid, usage);
                    this.lastIid = this.iid;
                    this.lastTotal = newTotal;
                } catch (e) {
                    this.logger.warn('Failed to fetch usage', e as Error);
                }
            }

            this.onCallComplete(this.iid);
            this.iid = undefined;
            this.runtime?.setIid(undefined);
            span.end();
        }
    }
}
