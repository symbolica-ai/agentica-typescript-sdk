import { ConceptMsg, DefMsg } from '@warpc/msg-protocol/concept/concept';
import { FrameID, RPCKind } from '@warpc/msg-protocol/kinds';

import { RpcMsg } from './rpc-msg';

export abstract class ResponseMsg extends RpcMsg {
    constructor(
        public readonly kind: RPCKind.ResponseAny,
        public readonly payload: any
    ) {
        super(kind);
    }

    setChannel(parentFID: FrameID, selfFID: FrameID): void {
        this.parentFID = parentFID;
        this.selfFID = selfFID;
    }
}

export class OkMsg extends ResponseMsg {
    constructor() {
        super(RPCKind.Response.Ok, null);
    }
}

export interface ErrPayload {
    error: ConceptMsg;
}

export class ErrMsg extends ResponseMsg {
    public defs: DefMsg[] = [];

    constructor(public readonly payload: ErrPayload) {
        super(RPCKind.Response.Err, payload);
    }
}

export interface ResPayload {
    result: ConceptMsg;
}

export class ResMsg extends ResponseMsg {
    public defs: DefMsg[] = [];

    constructor(public readonly payload: ResPayload) {
        super(RPCKind.Response.Res, payload);
    }
}
