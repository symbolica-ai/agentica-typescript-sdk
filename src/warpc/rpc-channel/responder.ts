import type { ScopedLogger } from '@logging/index';

import { AGENTICA_CALL_ID, AGENTICA_ELAPSED_TIME } from '@agentica-client/global-csm';
import { Frame } from '@warpc/frame';
import { MethodSignatureMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { RefMsg } from '@warpc/msg-protocol/concept/concept';
import {
    ForeignExceptionMsg,
    GenericExceptionMsg,
    InternalErrorMsg,
} from '@warpc/msg-protocol/concept/exception/exception-msg';
import { ClassMsg, TypeArgument } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionArgument, FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ObjectMsg } from '@warpc/msg-protocol/concept/resource/object-msg';
import { CLASS_IDS } from '@warpc/msg-protocol/concept/resource/system-msg';
import { BoolMsg, StrMsg } from '@warpc/msg-protocol/concept/value/atom';
import { ConceptKind, DefnUID, RPCKind, World } from '@warpc/msg-protocol/kinds';
import {
    CallArg,
    CallFunctionMsg,
    CallMethodMsg,
    CallNewMsg,
    GetAttrMsg,
    HasAttrMsg,
    InstanceOfMsg,
    RequestMsg,
    SetAttrMsg,
} from '@warpc/msg-protocol/rpc/request-msg';
import { ErrMsg, OkMsg, ResMsg, ResponseMsg } from '@warpc/msg-protocol/rpc/response-msg';

const SYNCIFY_ALL_CALLS = false;

export class RpcResponder {
    private logger: ScopedLogger | undefined;

    /**
     * Decodes arguments from a call message, handling rest params and runtime substitutions.
     * Runtime substitutions are detected by certain default markers (e.g. AGENTICA_CALL_ID).
     */
    private decodeArguments(argSchema: FunctionArgument[], payloadArgs: CallArg[], frame: Frame): any[] {
        const args: any[] = [];

        for (let index = 0; index < Math.max(argSchema.length, payloadArgs.length); index++) {
            const argInfo: FunctionArgument | undefined = argSchema[index];
            const argTypeMsg: ClassMsg | undefined = argInfo?.type
                ? frame.context.classes.getMessageFromUID(argInfo.type.uid)
                : undefined;

            // Rest params are unwrapped later
            if (argInfo?.rest) {
                if (index < payloadArgs.length) {
                    args.push(frame.conceptDecoder.decodeWithCtx(payloadArgs[index].val, argTypeMsg));
                }
                break; // Rest params are always the last argument
            }

            // Runtime substitutions via special default marker
            const defaultVal = argInfo?.default
                ? frame.conceptDecoder.decodeWithCtx(argInfo.default, undefined)
                : undefined;
            if (defaultVal && defaultVal === AGENTICA_CALL_ID) {
                args.push(frame.runtime.iid);
                continue;
            }
            if (defaultVal && defaultVal === AGENTICA_ELAPSED_TIME) {
                args.push(frame.runtime.elapsedTimeInSeconds);
                continue;
            }

            // No substitution and argument provided
            if (index >= payloadArgs.length) {
                args.push(undefined);
                continue;
            }

            // Decode provided argument
            args.push(frame.conceptDecoder.decodeWithCtx(payloadArgs[index].val, argTypeMsg));
        }

        // Unwrap rest parameter array if last param is rest
        const lastArgIdx = argSchema.length - 1;
        if (lastArgIdx >= 0 && argSchema[lastArgIdx].rest && args.length > lastArgIdx) {
            const restArg = args[lastArgIdx];
            if (Array.isArray(restArg)) {
                return [...args.slice(0, lastArgIdx), ...restArg];
            }
        }
        return args;
    }

    /**
     * Helper method to extract the return type from a function or method message.
     * Handles both regular FunctionMsg and arrow functions stored as ObjectMsg.
     * Returns undefined for Map/Dict types (index signatures) so they're encoded as MapMsg not ObjectMsg.
     */
    private getReturnTypeClassMsg(functionOrMethodUID: DefnUID, frame: Frame): ClassMsg | undefined {
        const msg = frame.context.getMessageFromUID(functionOrMethodUID);
        let returnTypeMsg: ClassMsg | undefined;

        // Case 1: direct function
        // For regular FunctionMsg or MethodSignatureMsg, get returnType directly
        if (msg?.kind === ConceptKind.Resource.Func || msg?.kind === ConceptKind.Annotation.MemberSig) {
            const payload = (msg as FunctionMsg).payload;
            if (payload?.returnType) {
                returnTypeMsg = frame.context.getMessageFromUID(payload.returnType.uid) as ClassMsg | undefined;
            }
        }

        // Case 2: arrow function object
        // For arrow functions stored as ObjectMsg, grab the embedded FunctionMsg
        else if (msg?.kind === ConceptKind.Resource.Obj) {
            const objMsg = msg as ObjectMsg;
            const clsMsg = frame.context.getMessageFromUID(objMsg.payload.cls!.uid) as ClassMsg | undefined;
            // Check if this is a function object using isFunction()
            if (clsMsg?.isFunction() && clsMsg.payload.supplied_type_args) {
                const embeddedFuncMsg = clsMsg.payload.supplied_type_args as FunctionMsg;
                if (embeddedFuncMsg?.payload?.returnType) {
                    returnTypeMsg = frame.context.getMessageFromUID(embeddedFuncMsg.payload.returnType.uid) as
                        | ClassMsg
                        | undefined;
                }
            }
        }

        return returnTypeMsg;
    }

    filterContextTypeClassMsg(returnTypeMsg: ClassMsg | undefined, frame: Frame): ClassMsg | undefined {
        // Unwrap promises when syncifying calls
        if (returnTypeMsg?.isFuture() && SYNCIFY_ALL_CALLS) {
            this.logger?.debug(`Unwrapping promise return type`);
            const type_arg = (returnTypeMsg.payload.supplied_type_args as TypeArgument[])[0].type;
            // for system types this will be undefined; we don't care...
            returnTypeMsg = frame.context.classes.getMessageFromUID(type_arg.uid);
        }

        // Exempt primitive types from encoder
        // Exempt Object generics from encoder (Object generic == we know nothing!)
        if (returnTypeMsg?.isPrimitive() || returnTypeMsg?.isObject()) {
            return undefined;
        }

        return returnTypeMsg;
    }

    constructor() {}

    async respondTo(msg: RequestMsg, frame: Frame): Promise<ResponseMsg> {
        this.logger = frame.logger.withScope('responder');
        const span = this.logger.startSpan(`respondTo-${msg.kind}`);
        try {
            let response: ResponseMsg;
            if (msg.defs.length > 0) {
                this.logger.debug(`Ingesting ${msg.defs.length} defs from request`);
            }
            frame.passContextFromRemoteDefs(msg.defs);
            switch (msg.kind) {
                case RPCKind.Request.New:
                    response = await this.respondToNew(msg, frame);
                    break;
                case RPCKind.Request.Call:
                    response = await this.respondToCall(msg, frame);
                    break;
                case RPCKind.Request.CallMethod:
                    response = await this.respondToCallMethod(msg, frame);
                    break;
                case RPCKind.Request.HasAttr:
                case RPCKind.Request.GetAttr:
                case RPCKind.Request.SetAttr:
                case RPCKind.Request.DelAttr:
                    {
                        try {
                            response = await this.respondToAttrRequest(
                                msg as HasAttrMsg | GetAttrMsg | SetAttrMsg,
                                frame
                            );
                        } catch {
                            const keyErrorRef = new RefMsg(ConceptKind.Resource.Cls, {
                                world: World.Client,
                                resource: CLASS_IDS.KeyError,
                            });
                            return new ErrMsg({
                                error: new ForeignExceptionMsg(ConceptKind.Exception.Foreign, keyErrorRef, [
                                    new StrMsg('Attribute request failed'),
                                ]),
                            });
                        }
                    }
                    break;
                case RPCKind.Request.InstanceOf:
                    response = await this.respondToInstanceOf(msg, frame);
                    break;
                default:
                    this.logger.error(`Unknown request kind: ${msg.kind}`);
                    throw new Error(`Unknown request kind: ${msg.kind}`);
            }
            span.setAttribute('response_kind', response.kind);
            return response;
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    async respondToNew(msg: CallNewMsg, frame: Frame): Promise<ResponseMsg> {
        const localClsMsg = frame.context.getMessageFromUID(msg.payload.cls.uid);
        if (!localClsMsg || localClsMsg.kind != ConceptKind.Resource.Cls) {
            if (!!localClsMsg && localClsMsg.kind == ConceptKind.Annotation.Interface) {
                this.logger?.warn('Attempted to instantiate interface');
                return new ErrMsg({
                    error: GenericExceptionMsg.makeFromError(new Error('Abstract classes cannot be instantiated')),
                });
            }
            this.logger?.warn(`Class not found: ${msg.payload.cls.uid.resource}`);
            return new ErrMsg({ error: GenericExceptionMsg.makeFromError(new Error('Class not found')) });
        }

        const LocalConstructor = frame.context.getResourceFromUID(msg.payload.cls.uid);
        const className = (localClsMsg as ClassMsg).payload.name;

        try {
            // Validate and decode arguments
            const ctorArgSchema = (localClsMsg as ClassMsg).payload.ctor_args || [];

            // Check argument count
            // NOTE: This has to be in typescript because of the way that newMessage is separate from ordinary method calls.
            const requiredArgs = ctorArgSchema.filter((arg) => !arg.optional).length;
            if (msg.payload.args.length < requiredArgs) {
                throw new TypeError(
                    `missing required positional arguments, expected ${requiredArgs}, got ${msg.payload.args.length}`
                );
            }

            const args = this.decodeArguments(ctorArgSchema, msg.payload.args, frame);

            // Instantiate
            const result = new LocalConstructor(...args);
            this.logger?.debug(`Instantiated ${className} with ${args.length} args`);

            // Encode result
            const resultTermMsg = frame.conceptEncoder.encodeWithCtx(result, -1, [], localClsMsg as ClassMsg);
            if (resultTermMsg.isDef) {
                const resRefMsg = resultTermMsg.referentialize();
                return new ResMsg({ result: resRefMsg });
            }
            return new ResMsg({ result: resultTermMsg });
        } catch (error) {
            this.logger?.error(`Failed to instantiate ${className}`, error as Error);
            return new ErrMsg({
                error: GenericExceptionMsg.makeFromError(
                    new Error(`${className}() failed: ${error instanceof Error ? error.message : String(error)}`)
                ),
            });
        }
    }

    async respondToCall(msg: CallFunctionMsg, frame: Frame): Promise<ResponseMsg> {
        const localFun = frame.context.getResourceFromUID(msg.payload.fun.uid);
        if (!localFun) {
            this.logger?.warn(`Function not found: ${msg.payload.fun.uid.resource}`);
            return new ErrMsg({ error: GenericExceptionMsg.makeFromError(new Error('Function not found')) });
        }
        const funMsg = frame.context.functions.getMessageFromUID(msg.payload.fun.uid);
        const argSchema: FunctionArgument[] = funMsg?.payload?.arguments || [];
        const args = this.decodeArguments(argSchema, msg.payload.args, frame);

        let result: any;
        try {
            if (SYNCIFY_ALL_CALLS) {
                const maybe = localFun(...args);
                result = await Promise.resolve(maybe);
            } else {
                result = localFun(...args);
            }
            this.logger?.debug(`Called function ${funMsg?.payload?.name} with ${args.length} args`);
        } catch (error) {
            this.logger?.error(`Function call failed`, error as Error);
            return new ErrMsg({
                error: GenericExceptionMsg.makeFromError(error as Error),
            });
        }

        const returnTypeClsMsg = this.getReturnTypeClassMsg(msg.payload.fun.uid, frame);
        this.logger?.debugObject('Returning result of type: ', returnTypeClsMsg);
        const resultTermMsg = frame.conceptEncoder.encodeWithCtx(result, -1, [], returnTypeClsMsg);
        if (resultTermMsg.isDef) {
            const resRefMsg = resultTermMsg.referentialize();
            return new ResMsg({ result: resRefMsg });
        }
        return new ResMsg({ result: resultTermMsg });
    }

    async respondToCallMethod(msg: CallMethodMsg, frame: Frame): Promise<ResponseMsg> {
        const localOwner = frame.context.getResourceFromUID(msg.payload.owner.uid);
        const localOwnerMsg = frame.context.getMessageFromUID(msg.payload.owner.uid);
        if (!localOwner || !localOwnerMsg) {
            this.logger?.debug(`Method owner not found: ${msg.payload.owner.uid.resource}`);
            return new ErrMsg({
                error: new InternalErrorMsg(ConceptKind.Exception.Internal, 'Method owner not found'),
            });
        }

        let methodUID: DefnUID | undefined;
        if (msg.payload.method_ref) {
            methodUID = msg.payload.method_ref.uid;
        } else {
            const ownerCls = frame.context.classes.getMessageFromUID(localOwnerMsg.payload.cls.uid);
            if (!ownerCls) {
                this.logger?.debug('Owner class not found');
                return new ErrMsg({
                    error: GenericExceptionMsg.makeFromError(new Error('Owner class not found')),
                });
            }
            for (const method of (ownerCls as ClassMsg).payload.methods) {
                if (method.name === msg.payload.method_name) {
                    methodUID = method.function.uid;
                    break;
                }
            }
        }
        if (!methodUID) {
            this.logger?.debug(`Method ${msg.payload.method_name} not found`);
            return new ErrMsg({ error: GenericExceptionMsg.makeFromError(new Error('Method not found')) });
        }
        const methodMsg = frame.context.getMessageFromUID(methodUID);
        if (!methodMsg || methodMsg.kind !== ConceptKind.Annotation.MemberSig) {
            this.logger?.warn(`Method signature not found for ${msg.payload.method_name}`);
            return new ErrMsg({ error: GenericExceptionMsg.makeFromError(new Error('Method not found')) });
        }

        const argSchema: FunctionArgument[] = (methodMsg as MethodSignatureMsg).payload?.arguments || [];
        const args = this.decodeArguments(argSchema, msg.payload.args, frame);

        let result: any;
        try {
            const methodName = methodMsg.payload.name;

            if (SYNCIFY_ALL_CALLS) {
                const maybe = localOwner[methodName](...args);
                result = await Promise.resolve(maybe);
            } else {
                result = localOwner[methodName](...args);
            }

            this.logger?.debug(`Called method ${methodName} with ${args.length} args`);
        } catch (error) {
            this.logger?.error(`Method call ${methodMsg.payload.name} failed`, error as Error);
            return new ErrMsg({
                error: GenericExceptionMsg.makeFromError(error as Error),
            });
        }

        const returnTypeClsMsg = this.getReturnTypeClassMsg(methodUID, frame);
        const resultTermMsg = frame.conceptEncoder.encodeWithCtx(result, -1, [], returnTypeClsMsg);
        if (resultTermMsg.isDef) {
            const resRefMsg = resultTermMsg.referentialize();
            return new ResMsg({ result: resRefMsg });
        }
        return new ResMsg({ result: resultTermMsg });
    }

    async respondToAttrRequest(msg: HasAttrMsg | GetAttrMsg | SetAttrMsg, frame: Frame): Promise<ResponseMsg> {
        const uid = msg.payload.owner.uid;
        const localOwner = frame.context.getResourceFromUID(uid);
        const localMsg = frame.context.getMessageFromUID(uid);

        // Check for null attr - indicates invalid key type from Python
        if (msg.payload.attr === null) {
            const typeErrorRef = new RefMsg(ConceptKind.Resource.Cls, {
                world: World.Client,
                resource: CLASS_IDS.TypeError,
            });
            return new ErrMsg({
                error: new ForeignExceptionMsg(ConceptKind.Exception.Foreign, typeErrorRef, [
                    new StrMsg('Invalid key type for index signature'),
                ]),
            });
        }

        if (!localMsg || !localOwner) {
            this.logger?.warn(`Resource not found: ${uid.resource}`);
            // For attribute operations, return AttributeError
            if (msg.kind === RPCKind.Request.GetAttr || msg.kind === RPCKind.Request.HasAttr) {
                const attrName = msg.payload.attr;
                const errorMsg = `Attribute "${attrName}" not found (resource not found)`;
                const attrErrorRef = new RefMsg(ConceptKind.Resource.Cls, {
                    world: World.Client,
                    resource: CLASS_IDS.AttributeError,
                });
                return new ErrMsg({
                    error: new ForeignExceptionMsg(ConceptKind.Exception.Foreign, attrErrorRef, [new StrMsg(errorMsg)]),
                });
            }
            return new ErrMsg({
                error: GenericExceptionMsg.makeFromError(new Error('Resource or message not found')),
            });
        }
        let accessibleFields: string[] = [];
        let ownerClsMsg: ClassMsg | undefined;
        switch (localMsg.kind) {
            case ConceptKind.Resource.Obj: {
                const objMsg = localMsg as ObjectMsg;
                const ownerMsg = frame.context.getMessageFromUID(objMsg.payload.cls!.uid);
                // Support both ClassMsg and InterfaceMsg (InterfaceMsg extends ClassMsg structurally)
                ownerClsMsg = ownerMsg as ClassMsg | undefined;
                const clsFiledNames = ownerClsMsg?.getFieldNames?.() ?? [];
                const objKeys = objMsg.payload.keys ?? [];
                const runtimeKeys = Object.keys(localOwner);
                accessibleFields = [...clsFiledNames, ...objKeys, ...runtimeKeys];
                break;
            }
            case ConceptKind.Resource.Cls: {
                ownerClsMsg = localMsg as ClassMsg;
                accessibleFields = [...ownerClsMsg.getStaticFieldNames(), ...ownerClsMsg.getStaticMethodNames()];
                break;
            }
            default:
                this.logger?.warn(`Cannot access attribute on ${msg.kind}`);
                return new ErrMsg({
                    error: GenericExceptionMsg.makeFromError(new Error(`Cannot access attribute on ${msg.kind}`)),
                });
        }
        const attrExistsStatically = accessibleFields.includes(msg.payload.attr);
        const attrExistsAtRuntime = msg.payload.attr in localOwner;
        // For SetAttr/DelAttr with index signature, allow operating on dynamic keys
        const hasIndexSignature = ownerClsMsg?.payload?.index_signature !== undefined;

        if (!hasIndexSignature && attrExistsStatically !== attrExistsAtRuntime) {
            this.logger?.debug(
                `Request ${msg.kind} for attribute ${msg.payload.attr} - mismatch between static and runtime analysis: static=${attrExistsStatically} !== runtime=${attrExistsAtRuntime}`
            );
        }

        // Try to determine field type
        let fieldTypeClsMsg: ClassMsg | undefined;
        if (ownerClsMsg) {
            const field = ownerClsMsg.payload.fields?.find((f) => f.name === msg.payload.attr);
            if (field?.type) {
                fieldTypeClsMsg = frame.context.getMessageFromUID(field.type.uid) as ClassMsg | undefined;
            } else if (ownerClsMsg.payload.index_signature) {
                fieldTypeClsMsg = frame.context.getMessageFromUID(
                    ownerClsMsg.payload.index_signature.value_type.uid
                ) as ClassMsg | undefined;
            }
        }

        if (fieldTypeClsMsg) {
            this.logger?.debug(`Accessing attribute ${msg.payload.attr} with type: ${fieldTypeClsMsg.payload.name}`);
        } else {
            this.logger?.debug(`Could not determine field type for attribute ${msg.payload.attr}`);
        }

        if (attrExistsAtRuntime || (msg.kind === RPCKind.Request.SetAttr && hasIndexSignature)) {
            switch (msg.kind) {
                case RPCKind.Request.HasAttr:
                    this.logger?.debug(`Has attribute ${msg.payload.attr}: ${attrExistsAtRuntime}`);
                    return new ResMsg({ result: new BoolMsg(attrExistsAtRuntime) });
                case RPCKind.Request.GetAttr: {
                    const getVal = await Promise.resolve(localOwner[msg.payload.attr]);

                    this.logger?.debugObject('Trying to encode the attribute value: ', getVal);
                    const resultTermMsg = frame.conceptEncoder.encodeWithCtx(getVal, -1, [], fieldTypeClsMsg);

                    // Bind methods to their owner to preserve `this` context when called later
                    if (typeof getVal === 'function') {
                        frame.context.updateExistingResource(uid, getVal.bind(localOwner));
                    }

                    this.logger?.debug(`Got attribute ${msg.payload.attr}`);
                    return new ResMsg({ result: resultTermMsg });
                }
                case RPCKind.Request.SetAttr:
                    try {
                        const decoded = frame.conceptDecoder.decodeWithCtx(
                            (msg as SetAttrMsg).payload.val,
                            fieldTypeClsMsg
                        );
                        const jsVal = await Promise.resolve(decoded);
                        localOwner[msg.payload.attr] = jsVal;
                        this.logger?.debug(`Set attribute ${msg.payload.attr}`);
                    } catch (error) {
                        this.logger?.error(`Attribute set failed for ${msg.payload.attr}`, error as Error);
                        return new ErrMsg({
                            error: GenericExceptionMsg.makeFromError(error as Error),
                        });
                    }
                    return new OkMsg();
                case RPCKind.Request.DelAttr:
                    // For deletion, we need to check if the key actually exists
                    // (can't just check hasIndexSignature because we need to raise KeyError if key doesn't exist)
                    if (attrExistsAtRuntime) {
                        delete localOwner[msg.payload.attr];
                        this.logger?.debug(`Deleted attribute ${msg.payload.attr}`);
                        return new OkMsg();
                    }
                    // If key doesn't exist, fall through to error handling below
                    break;
                default:
                    return new ErrMsg({
                        error: GenericExceptionMsg.makeFromError(new Error('Unknown attribute request kind')),
                    });
            }
        }
        // Attribute not found
        this.logger?.warn(`Trying to access attribute ${msg.payload.attr} but it was not found`);

        // For HasAttr, return false instead of an error
        if (msg.kind === RPCKind.Request.HasAttr) {
            this.logger?.debug(`Has attribute ${msg.payload.attr}: false`);
            return new ResMsg({ result: new BoolMsg(false) });
        }

        // For GetAttr/SetAttr/DelAttr, determine if it's an AttributeError or KeyError
        const definedFields = ownerClsMsg?.payload?.fields?.map((f) => f.name) || [];
        const isDefinedField = definedFields.includes(msg.payload.attr);

        // AttributeError: for defined fields that are missing
        // KeyError: for dynamic keys (index signature) that are missing
        const errorClass = isDefinedField || !hasIndexSignature ? CLASS_IDS.AttributeError : CLASS_IDS.KeyError;

        const errorMsg =
            errorClass === CLASS_IDS.KeyError
                ? `Key "${msg.payload.attr}" not found`
                : `Attribute "${msg.payload.attr}" not found`;

        const errorRef = new RefMsg(ConceptKind.Resource.Cls, {
            world: World.Client,
            resource: errorClass,
        });

        return new ErrMsg({
            error: new ForeignExceptionMsg(ConceptKind.Exception.Foreign, errorRef, [new StrMsg(errorMsg)]),
        });
    }

    async respondToInstanceOf(_msg: InstanceOfMsg, _frame: Frame): Promise<ResponseMsg> {
        return new ErrMsg({
            error: GenericExceptionMsg.makeFromError(new Error('not implemented')),
        });
    }
}
