import { AgentInvocationHandle } from '@client-session-manager/client-session-manager';
import { type ScopedLogger, createLogger } from '@logging/index';

import { bytesToStr, strToBytes } from './utils';

// Websocket interface used by FrameMuxSocket (this sets onmessage as well)
export interface MinimalWebSocket {
    readyState: number;
    send(data: string): void;
    onmessage: ((ev: { data: string }) => void) | null;
    onclose: (() => void) | null;
    close(): void;
}

// Wrapper around AgentInvocationHandle
export class VirtualSocketForHandle<T extends AgentInvocationHandle> implements MinimalWebSocket {
    readyState = 1;
    onmessage: ((ev: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    #running = true;
    handle: T;
    #logger: ScopedLogger;

    constructor(handle: T, parentLogger?: ScopedLogger) {
        this.handle = handle;
        this.#logger = parentLogger?.withScope('socket:virtual') ?? createLogger('socket:virtual');
    }

    send(data: string): void {
        try {
            const bytes = strToBytes(data);
            void this.handle.send_message(bytes);
            this.#logger.debug(`Sent message (${bytes.length} bytes)`);
        } catch (error) {
            this.#logger.error('Failed to send message', error as Error);
        }
    }

    close(): void {
        this.#running = false;
        this.#logger.debug('Socket closed');
        return;
    }

    startReceiving(): void {
        this.#startRecvLoop();
    }

    async #startRecvLoop(): Promise<void> {
        this.#logger.debug('Starting receive loop');
        while (this.#running) {
            try {
                const bytes = await this.handle.recv_message();
                this.#logger.debug(`Received ${bytes.length} bytes`);
                const decoded = bytesToStr(bytes);
                if (this.onmessage) {
                    this.onmessage?.({ data: decoded });
                } else {
                    this.#logger.warn('Received bytes before onmessage is set');
                }
            } catch (error) {
                if (error instanceof Error && error.message === 'Queue closed') {
                    this.#logger.debug('Receive loop ended (queue closed)');
                } else {
                    this.#logger.debug('Receive loop ended because of an error', error as Error);
                }
                break;
            }
        }
    }
}
