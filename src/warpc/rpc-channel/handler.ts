import type { ScopedLogger } from '@logging/index';

import { Frame } from '@warpc/frame';
import { ConceptKind, FrameID, RPCKind } from '@warpc/msg-protocol/kinds';
import { FutureCompletedMsg } from '@warpc/msg-protocol/rpc/event-msg';
import { RequestMsg } from '@warpc/msg-protocol/rpc/request-msg';
import { ErrMsg, ResMsg, ResponseMsg } from '@warpc/msg-protocol/rpc/response-msg';
import { RpcMsg } from '@warpc/msg-protocol/rpc/rpc-msg';

import { FrameMuxSocket } from './mux';
import { RpcResponder } from './responder';
import { AnnotationMsg } from '../msg-protocol/concept/annotations/annotation-msg';
import { DefMsg } from '../msg-protocol/concept/concept';
import { GenericExceptionMsg } from '../msg-protocol/concept/exception/exception-msg';
import { ClassMsg } from '../msg-protocol/concept/resource/class-msg';
import { ObjectMsg } from '../msg-protocol/concept/resource/object-msg';

export class RpcHandler {
    public responder: RpcResponder;
    public owningFrame: Frame;
    public selfID: FrameID;
    public logger: ScopedLogger;

    constructor(owner: Frame) {
        this.responder = new RpcResponder();
        this.owningFrame = owner;
        this.selfID = owner.frameID;
        this.logger = owner.logger.withScope('rpc');
    }

    get remoteParentID(): FrameID {
        const remoteID = this.owningFrame.runtime.remoteParents.get(this.selfID)!;
        if (remoteID === undefined) {
            throw new Error(`Remote parent ID not found for local frame ${this.selfID}`);
        }
        return remoteID;
    }

    private get mux(): FrameMuxSocket {
        if (!this.owningFrame.runtime.socket) {
            throw new Error('FrameMux not set on runtime');
        }
        return this.owningFrame.runtime.socket;
    }

    async requestAndServeChild(request: RequestMsg): Promise<ResponseMsg> {
        const span = this.logger.startSpan(`requestAndServeChild-${request.kind}`);
        try {
            // Request!
            const requestedRemoteID = this.owningFrame.runtime.newRemoteFrameForLocalRequest(this.owningFrame.frameID);
            request.setParentChild(this.remoteParentID, this.owningFrame.frameID, requestedRemoteID);
            this.logger.debug(
                `Sending ${request.kind} request (local=${this.owningFrame.frameID} -> remote=${requestedRemoteID})`
            );
            span.setAttribute('request_kind', request.kind);
            span.setAttribute('local_frame', this.owningFrame.frameID);
            span.setAttribute('remote_frame', requestedRemoteID);
            await this.mux.send(request);

            // Serve!
            for await (const incoming of this.mux.listen(this.selfID, requestedRemoteID)) {
                if (RPCKind.isResponse((incoming as RpcMsg).kind)) {
                    const responseMsg = incoming as ResponseMsg;
                    await this.handleResponse(responseMsg, requestedRemoteID);
                    this.logger.debug(`Received ${responseMsg.kind} response`);
                    return responseMsg;
                }

                if (RPCKind.isRequest((incoming as RpcMsg).kind)) {
                    const requestMsg = incoming as RequestMsg;
                    this.logger.debug(`Serving counter-request ${requestMsg.kind}`);
                    await this.handleRequest(requestMsg);
                    continue;
                }
            }

            // Error!
            this.logger.error('Channel closed before receiving reply');
            throw new Error('Channel closed before receiving reply');
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    async handleRequest(requestMsg: RequestMsg): Promise<void> {
        const span = this.logger.startSpan(`handleRequest-${requestMsg.kind}`);
        try {
            const requestedHandlingFrame: Frame = this.owningFrame.runtime.newLocalFrameForRemoteRequest(
                this.owningFrame.frameID,
                requestMsg.requestedFID!,
                requestMsg.selfFID!
            );
            this.logger.debug(`Handling ${requestMsg.kind} in local frame ${requestedHandlingFrame.frameID}`);
            span.setAttribute('request_kind', requestMsg.kind);
            span.setAttribute('local_frame', requestedHandlingFrame.frameID);

            const response = await this.responder.respondTo(requestMsg, requestedHandlingFrame);
            response.setChannel(this.remoteParentID, requestedHandlingFrame.frameID);
            this.processResponseContext(response, requestedHandlingFrame.frameID);
            await this.mux.send(response);
            this.logger.debug(
                `Sent ${response.kind} response (from local=${requestedHandlingFrame.frameID} to remote=${requestMsg.selfFID})`
            );
        } catch (error) {
            span.recordException(error as Error);
            this.logger.error(`Failed to handle ${requestMsg.kind} request`, error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    async handleResponse(responseMsg: ResponseMsg, requestedRemoteID: FrameID): Promise<void> {
        if (responseMsg.selfFID !== requestedRemoteID) {
            this.logger.warn(
                `Response ${responseMsg.kind} has unexpected selfFID=${responseMsg.selfFID} (expected=${requestedRemoteID})`
            );
        }
        this.logger.debug(
            `Received ${responseMsg.kind} response (remote=${requestedRemoteID} -> local=${this.owningFrame.frameID})`
        );
        this.owningFrame.runtime.returnFromRemoteFrame(this.owningFrame.frameID, requestedRemoteID);
    }

    processResponseContext(responseMsg: ResponseMsg, handlingFrameID: FrameID): void {
        const newDefs = this.owningFrame.runtime.returnContextFromLocalFrame(handlingFrameID, responseMsg);
        if (newDefs.length > 0) {
            const remotePeerFID = responseMsg.parentFID;
            const unsentLocalDefs = this.owningFrame.runtime.filterUnsentLocalDefs(remotePeerFID, newDefs);
            (responseMsg as ResMsg).defs.push(...unsentLocalDefs);
            this.owningFrame.runtime.markDefsSent(remotePeerFID, unsentLocalDefs);
            this.logger.debug(`Attached ${unsentLocalDefs.length} new defs to response`);
        }
        this.attachFutureCallbacks(responseMsg);
    }

    attachFutureCallbacks(responseMsg: ResponseMsg): void {
        const onFutureCanceled = (futureId: number, err: Error): void => {
            this.logger.debug('onFutureCanceled triggered');
            const futureExc = GenericExceptionMsg.makeFromError(err);
            const errorResMsg = new ErrMsg({ error: futureExc });
            const futureCompletedMsg = new FutureCompletedMsg(futureId, errorResMsg);
            this.mux.send(futureCompletedMsg);
        };

        const onFutureCompleted = (
            futureId: number,
            expectedCls: ClassMsg | AnnotationMsg | undefined,
            result: any
        ): void => {
            this.logger.debug('onFutureCompleted triggered');
            const nestedDefs: DefMsg[] = [];
            const resultTermMsg = this.owningFrame.conceptEncoder.encodeWithCtx(result, -1, nestedDefs, expectedCls);
            if (resultTermMsg.isDef) {
                nestedDefs.push(resultTermMsg);
            }
            const resultRef = resultTermMsg.referentialize();
            const resultResMsg = new ResMsg({ result: resultRef });
            resultResMsg.defs.push(...nestedDefs);
            const futureCompletedMsg = new FutureCompletedMsg(futureId, resultResMsg);
            this.mux.send(futureCompletedMsg);
        };

        if (responseMsg.kind === RPCKind.Response.Res) {
            const msgsToCheck = [...(responseMsg as ResMsg).defs];
            for (const msg of msgsToCheck) {
                if (msg.kind === ConceptKind.Resource.Obj) {
                    const clsMsg = this.owningFrame.context.getMessageFromUID((msg as ObjectMsg).payload.cls!.uid);
                    if (clsMsg && (clsMsg as ClassMsg | AnnotationMsg).isFuture()) {
                        const type_arg = clsMsg.payload.supplied_type_args?.[0].type;
                        const expectedCls = this.owningFrame.context.classes.getMessageFromUID(type_arg.uid);
                        const futureId = msg.uid.resource;
                        const localPromise = this.owningFrame.context.getResourceFromUID((msg as ObjectMsg).uid);
                        if (localPromise) {
                            localPromise.then(
                                (value: any) => onFutureCompleted(futureId, expectedCls, value),
                                (err: any) => onFutureCanceled(futureId, err)
                            );
                        }
                    }
                }
            }
        }
    }

    // Submit without waiting for a response
    async submitRequest(request: RequestMsg): Promise<number> {
        const requestedRemoteID = this.owningFrame.runtime.newRemoteFrameForLocalRequest(this.owningFrame.frameID);
        request.setParentChild(this.remoteParentID, this.selfID, requestedRemoteID);
        await this.mux.send(request);
        return requestedRemoteID;
    }

    // Serve exactly one incoming item on the current channel
    async serveChildOnce(remoteChild: FrameID): Promise<ResponseMsg | undefined> {
        for await (const incoming of this.mux.listen(this.selfID, remoteChild)) {
            if (RPCKind.isResponse((incoming as RpcMsg).kind)) {
                return incoming as ResponseMsg;
            }
            if (RPCKind.isRequest((incoming as RpcMsg).kind)) {
                const requestMsg = incoming as RequestMsg;
                await this.handleRequest(requestMsg);
                return undefined;
            }
        }
    }
}
