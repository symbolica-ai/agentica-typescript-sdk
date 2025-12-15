import { type ScopedLogger, createLogger } from '@logging/index';
import { FrameID, World } from '@warpc/msg-protocol/kinds';
import { RpcMsg } from '@warpc/msg-protocol/rpc/rpc-msg';

import { MinimalWebSocket } from './socket';

export type Address = `pid:${number}_sid:${number}`;

function makeChannelKey(parentFrame: number, childFrame: number, _parentWorld: World): Address {
    return `pid:${parentFrame}_sid:${childFrame}`;
}

export type WireData = RpcMsg;

// parent-child message queue
class PCMsgQueue<T> implements AsyncIterable<T> {
    private queue: (T | null)[] = [];
    private pendingNextResolve?: (r: IteratorResult<T>) => void;

    push(v: T) {
        if (this.pendingNextResolve) {
            this.pendingNextResolve({ value: v, done: false });
            this.pendingNextResolve = undefined;
        } else {
            this.queue.push(v);
        }
    }

    close() {
        if (this.pendingNextResolve) {
            this.pendingNextResolve({ value: undefined as any, done: true });
            this.pendingNextResolve = undefined;
        } else {
            this.queue.push(null);
        }
    }

    [Symbol.asyncIterator]() {
        return {
            next: (): Promise<IteratorResult<T>> => {
                if (this.queue.length) {
                    const v = this.queue.shift()!;
                    return Promise.resolve(
                        v === null ? { value: undefined as any, done: true } : { value: v, done: false }
                    );
                }
                return new Promise<IteratorResult<T>>((resolve) => {
                    this.pendingNextResolve = resolve;
                });
            },
        };
    }
}

export class FrameMuxSocket {
    readonly world: World;
    private ws: MinimalWebSocket;
    private channels = new Map<Address, PCMsgQueue<RpcMsg>>();
    private nextRemote = 1;
    private logger: ScopedLogger;

    constructor(world: World, ws: MinimalWebSocket, parentLogger?: ScopedLogger) {
        this.world = world;
        this.logger = parentLogger?.withScope('mux') ?? createLogger(`mux:${world}`);
        this.ws = ws;
        ws.onmessage = (event) => this.handle(JSON.parse(event.data) as WireData);
        ws.onclose = () => {
            this.logger.debug('WebSocket onclose, closing all channels');
            for (const [, queue] of this.channels) queue.close();
            this.channels.clear();
        };
        ws.readyState = 1;
        this.logger.debug('FrameMuxSocket initialized');
    }

    nextRemoteId(): FrameID {
        return this.nextRemote++;
    }

    listen(parentFID: FrameID, selfFID: FrameID): AsyncIterable<RpcMsg> {
        const key = makeChannelKey(parentFID, selfFID, this.world);
        this.logger.debug(`Listening on channel ${key}`);
        let q = this.channels.get(key);
        if (!q) {
            q = new PCMsgQueue<RpcMsg>();
            this.channels.set(key, q);
        }
        return q;
    }

    async send(msg: RpcMsg) {
        const channelKey = makeChannelKey(msg.parentFID, msg.selfFID, this.world);
        this.logger.debugObject(`Sending ${msg.kind} on channel ${channelKey}`, msg);
        this.ws.send(JSON.stringify(msg));
    }

    close() {
        this.ws.close();
    }

    private handle(data: WireData) {
        const msg = data as RpcMsg;
        const channelKey = makeChannelKey(msg.parentFID, msg.selfFID, this.world);
        this.logger.debugObject(`Received ${msg.kind}, forwarding to channel ${channelKey}`, msg);

        let queue = this.channels.get(channelKey);
        if (!queue) {
            this.logger.debug(`Channel ${channelKey} not found, creating new queue`);
            queue = new PCMsgQueue<RpcMsg>();
            this.channels.set(channelKey, queue);
        }
        queue.push(msg);
    }
}

export const FrameMuxUtils = { makeChannelKey: makeChannelKey };
