import { MethodSignatureMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { DefMsg, NoDefMsg, RefMsg } from '@warpc/msg-protocol/concept/concept';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ResourceMsg } from '@warpc/msg-protocol/concept/resource/resource-msg';
import { FrameID, RPCKind } from '@warpc/msg-protocol/kinds';
import { RpcMsg } from '@warpc/msg-protocol/rpc/rpc-msg';

export abstract class RequestMsg extends RpcMsg {
    public requestedFID: number | undefined = undefined;
    public defs: DefMsg[] = [];

    constructor(
        public readonly kind: RPCKind.RequestAny,
        public readonly payload: any
    ) {
        super(kind);
    }

    setParentChild(parentFID: FrameID, selfFID: FrameID, newChildOfChild: FrameID): void {
        this.parentFID = parentFID;
        this.selfFID = selfFID;
        this.requestedFID = newChildOfChild;
    }
}

///

export type CallArg = {
    name: string; // For bookkeeping
    val: NoDefMsg;
};

///

export interface CallNewPayload {
    cls: RefMsg<ClassMsg>;
    type_args?: { [key: string]: NoDefMsg };
    args: CallArg[];
}

export class CallNewMsg extends RequestMsg {
    constructor(public readonly payload: CallNewPayload) {
        super(RPCKind.Request.New, payload);
    }
}

///

export interface CallFunctionPayload {
    fun: RefMsg<FunctionMsg>;
    args: CallArg[];
}

export class CallFunctionMsg extends RequestMsg {
    constructor(public readonly payload: CallFunctionPayload) {
        super(RPCKind.Request.Call, payload);
    }
}

///

export interface CallMethodPayload {
    owner: RefMsg<ResourceMsg>;
    args: CallArg[];
    method_name: string;
    method_ref?: RefMsg<MethodSignatureMsg>;
}

export class CallMethodMsg extends RequestMsg {
    constructor(public readonly payload: CallMethodPayload) {
        super(RPCKind.Request.Call, payload);
    }
}

///

export interface HasAttrPayload {
    owner: RefMsg<ResourceMsg>;
    attr: string | null;
}

export class HasAttrMsg extends RequestMsg {
    constructor(public readonly payload: HasAttrPayload) {
        super(RPCKind.Request.HasAttr, payload);
    }
}

///

export interface GetAttrPayload {
    owner: RefMsg<ResourceMsg>;
    attr: string | null;
}

export class GetAttrMsg extends RequestMsg {
    constructor(public readonly payload: GetAttrPayload) {
        super(RPCKind.Request.GetAttr, payload);
    }
}

///

export interface SetAttrPayload {
    owner: RefMsg<ResourceMsg>;
    attr: string | null;
    val: NoDefMsg;
}

export class SetAttrMsg extends RequestMsg {
    constructor(public readonly payload: SetAttrPayload) {
        super(RPCKind.Request.SetAttr, payload);
    }
}

///

export interface DelAttrPayload {
    owner: RefMsg<ResourceMsg>;
    attr: string | null;
}

export class DelAttrMsg extends RequestMsg {
    constructor(public readonly payload: DelAttrPayload) {
        super(RPCKind.Request.DelAttr, payload);
    }
}

///

export interface InstanceOfPayload {
    concept: RefMsg<ResourceMsg>;
    cls: ClassMsg;
}

export class InstanceOfMsg extends RequestMsg {
    constructor(public readonly payload: InstanceOfPayload) {
        super(RPCKind.Request.InstanceOf, payload);
    }
}
