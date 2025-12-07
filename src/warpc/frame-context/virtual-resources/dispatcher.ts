import type { ScopedLogger } from '@logging/index';

import { Frame } from '@warpc/frame';
import { MethodSignatureMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { ConceptMsg, RefMsg } from '@warpc/msg-protocol/concept/concept';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionArgument, FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ObjectMsg } from '@warpc/msg-protocol/concept/resource/object-msg';
import { ConceptKind, DefnUID, RPCKind } from '@warpc/msg-protocol/kinds';
import {
    CallArg,
    CallFunctionMsg,
    CallMethodMsg,
    CallNewMsg,
    GetAttrMsg,
    HasAttrMsg,
    SetAttrMsg,
} from '@warpc/msg-protocol/rpc/request-msg';
import { RpcHandler } from '@warpc/rpc-channel/handler';

import { VirtualDispatcher } from './virtualizer';

export class DefaultVirtualDispatcher extends VirtualDispatcher {
    private logger: ScopedLogger;

    constructor(owner: Frame) {
        super(owner);
        this.logger = owner.logger.withScope('dispatcher');
    }

    setRpcHandler(handler: RpcHandler): void {
        this.handler = handler;
    }

    async virtualNew(uid: DefnUID, args: any[], systemResource: boolean): Promise<any> {
        const span = this.logger.startSpan(`virtualNew-${uid.resource}`);
        try {
            this.logger.debug(`virtualNew(${uid.resource}, ${args})`);
            const defMsg = this.owner.context.classes.getMessageFromUID(uid)!;
            this.logger.debug(`defMsg from uid=${uid.resource}`, defMsg);

            let argsMsg: CallArg[];
            if (defMsg.payload.ctor_args === undefined) {
                argsMsg = args.map((arg, index) => {
                    const argMsg = this.owner.conceptEncoder.encodeWithCtx(arg).referentialize();
                    return { name: `pos_arg_${index}`, val: argMsg };
                });
            } else {
                const argsSchema: FunctionArgument[] = defMsg.payload.ctor_args!;
                argsMsg = argsSchema.map((funArg, index) => {
                    const arg = args[index] ?? undefined;
                    const argMsg = this.owner.conceptEncoder.encodeWithCtx(arg).referentialize();
                    return { name: funArg.name, val: argMsg };
                });
            }

            this.logger.debug(`Creating instance of ${defMsg.payload.name} with ${argsMsg.length} args`);
            span.setAttribute('class_name', defMsg.payload.name);
            span.setAttribute('args_count', argsMsg.length);

            const request: CallNewMsg = new CallNewMsg({
                cls: ClassMsg.createClassRefMsg(uid, systemResource),
                args: argsMsg,
            });
            this.logger.debug(`virtualNew request:`, request);

            if (!this.handler) throw new Error('Handler not set');
            const response = await this.handler.requestAndServeChild(request);
            switch (response.kind) {
                case RPCKind.Response.Res: {
                    const result: ConceptMsg = response.payload.result;
                    this.logger.debug(`virtualNew response:`, result);
                    return this.owner.conceptDecoder.decodeWithCtx(result);
                }
                case RPCKind.Response.Err:
                    this.logger.error(`Virtual new failed: ${response.payload.error}`);
                    throw new Error(response.payload.error);
                default:
                    throw new Error('Unexpected response kind for New: ' + response.kind);
            }
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    async virtualFunctionCall(functionID: DefnUID, args: any[]): Promise<any> {
        const span = this.logger.startSpan(`virtualFunctionCall-${functionID.resource}`);
        try {
            const funMsg = this.owner.context.getMessageFromUID(functionID)!;
            const argsSchema: FunctionArgument[] = (funMsg as FunctionMsg).payload.arguments!;

            if (!argsSchema) {
                this.logger.error('No args schema found');
                throw new Error('No args schema found');
            }

            const argsMsg: CallArg[] = argsSchema.map((argSchema, index) => {
                const arg = args[index] ?? undefined;
                const argMsg = this.owner.conceptEncoder.encodeWithCtx(arg).referentialize();
                return { name: argSchema.name, val: argMsg };
            });

            this.logger.debug(`Calling function ${(funMsg as FunctionMsg).payload.name} with ${args.length} args`);
            span.setAttribute('function_name', (funMsg as FunctionMsg).payload.name);
            span.setAttribute('args_count', args.length);

            const request: CallFunctionMsg = new CallFunctionMsg({
                fun: FunctionMsg.createFunctionRefMsg(functionID),
                args: argsMsg,
            });

            if (!this.handler) throw new Error('Handler not set');
            const response = await this.handler.requestAndServeChild(request);
            switch (response.kind) {
                case RPCKind.Response.Res: {
                    const result: ConceptMsg = response.payload.result;
                    return this.owner.conceptDecoder.decodeWithCtx(result);
                }
                case RPCKind.Response.Err:
                    this.logger.error(`Virtual function call failed: ${response.payload.error}`);
                    throw new Error(response.payload.error);
                default:
                    throw new Error('Unexpected response kind for FunctionCall: ' + response.kind);
            }
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    async virtualMethodCall(ownerID: DefnUID, methodName: string, args: any[]): Promise<any> {
        const span = this.logger.startSpan(`virtualMethodCall-${methodName}`);
        try {
            const ownerMsg = this.owner.context.getMessageFromUID(ownerID)!;
            let clsMsg: ClassMsg;

            switch (ownerMsg.kind) {
                case ConceptKind.Resource.Cls:
                    clsMsg = ownerMsg as ClassMsg;
                    break;
                case ConceptKind.Resource.Obj:
                    {
                        const clsRef = (ownerMsg as ObjectMsg).payload.cls!;
                        clsMsg = this.owner.context.getMessageFromUID(clsRef.uid)! as ClassMsg;
                    }
                    break;
                default:
                    this.logger.error(`Unexpected owner kind: ${ownerMsg.kind}`);
                    throw new Error('Unexpected owner kind for MethodCall: ' + ownerMsg.kind);
            }

            const methodRef = clsMsg.getMethods().get(methodName);
            const methodMsg = this.owner.context.getMessageFromUID(methodRef!.uid)!;
            const argsSchema: FunctionArgument[] = (methodMsg as MethodSignatureMsg).payload.arguments!;

            if (!argsSchema) {
                this.logger.error('No args schema found');
                throw new Error('No args schema found');
            }

            const argsMsg: CallArg[] = argsSchema.map((argSchema, index) => {
                const arg = args[index] ?? undefined;
                const argMsg = this.owner.conceptEncoder.encodeWithCtx(arg).referentialize();
                return { name: argSchema.name, val: argMsg };
            });

            this.logger.debug(`Calling method ${methodName} with ${args.length} args`);
            span.setAttribute('method_name', methodName);
            span.setAttribute('args_count', args.length);

            const request: CallMethodMsg = new CallMethodMsg({
                method_name: methodName,
                method_ref: methodRef!,
                owner: new RefMsg(ownerMsg.kind, ownerID),
                args: argsMsg,
            });

            if (!this.handler) throw new Error('Handler not set');
            const response = await this.handler.requestAndServeChild(request);
            switch (response.kind) {
                case RPCKind.Response.Res: {
                    const result: ConceptMsg = response.payload.result;
                    return this.owner.conceptDecoder.decodeWithCtx(result);
                }
                case RPCKind.Response.Err:
                    this.logger.error(`Virtual method call failed: ${response.payload.error}`);
                    throw new Error(response.payload.error);
                default:
                    throw new Error('Unexpected response kind for MethodCall: ' + response.kind);
            }
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    async virtualSetAttr(uid: DefnUID, name: string, value: any): Promise<void> {
        const span = this.logger.startSpan(`virtualSetAttr-${name}`);
        try {
            const defMsg = this.owner.context.getMessageFromUID(uid)!;
            const valueMsg = this.owner.conceptEncoder.encodeWithCtx(value).referentialize();

            this.logger.debug(`Setting attribute ${name} (uid=${uid.resource})`);
            span.setAttribute('attr_name', name);

            const request: SetAttrMsg = new SetAttrMsg({
                owner: new RefMsg(defMsg.kind, uid),
                attr: name,
                val: valueMsg,
            });
            if (!this.handler) throw new Error('Handler not set');
            const response = await this.handler.requestAndServeChild(request);
            switch (response.kind) {
                case RPCKind.Response.Ok:
                    return;
                case RPCKind.Response.Err:
                    this.logger.error(`Virtual setAttr failed: ${response.payload.error}`);
                    throw new Error(response.payload.error);
                default:
                    throw new Error('Unexpected response kind for SetAttr: ' + response.kind);
            }
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    async virtualGetAttr(uid: DefnUID, name: string): Promise<any> {
        const span = this.logger.startSpan(`virtualGetAttr-${name}`);
        try {
            const defMsg = this.owner.context.getMessageFromUID(uid)!;
            this.logger.debug(`Getting attribute ${name} (uid=${uid.resource})`);
            span.setAttribute('attr_name', name);

            const request: GetAttrMsg = new GetAttrMsg({
                owner: new RefMsg(defMsg.kind, uid),
                attr: name,
            });
            if (!this.handler) throw new Error('Handler not set');
            const response = await this.handler.requestAndServeChild(request);
            switch (response.kind) {
                case RPCKind.Response.Res: {
                    const result: ConceptMsg = response.payload.result;
                    return this.owner.conceptDecoder.decodeWithCtx(result);
                }
                case RPCKind.Response.Err:
                    this.logger.error(`Virtual getAttr failed: ${response.payload.error}`);
                    throw new Error(response.payload.error);
                default:
                    throw new Error('Unexpected response kind for GetAttr: ' + response.kind);
            }
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    async virtualHasAttr(uid: DefnUID, name: string): Promise<boolean> {
        const defMsg = this.owner.context.getMessageFromUID(uid)!;
        const request: HasAttrMsg = new HasAttrMsg({
            owner: new RefMsg(defMsg.kind, uid),
            attr: name,
        });
        if (!this.handler) throw new Error('Handler not set');
        const response = await this.handler.requestAndServeChild(request);
        return response.kind === RPCKind.Response.Ok;
    }

    async virtualDelAttr(_uid: DefnUID, _name: string): Promise<void> {
        throw new Error('Attribute deletion not implemented');
    }
}
