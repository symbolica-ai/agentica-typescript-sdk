import { FrameID, Msg, RPCKind } from '@warpc/msg-protocol/kinds';

export abstract class RpcMsg extends Msg {
    constructor(
        public readonly kind: RPCKind.RpcAny,
        public parentFID: FrameID = -1,
        public selfFID: FrameID = -1
    ) {
        super();
    }
}
