import { RPCKind } from '../kinds';
import { ErrMsg, ResMsg } from './response-msg';
import { RpcMsg } from './rpc-msg';

export class FutureCanceledMsg extends RpcMsg {
    future_id: number;

    constructor(future_id: number) {
        super(RPCKind.Event.FutureCanceled);
        this.future_id = future_id;
    }
}

export class FutureCompletedMsg extends RpcMsg {
    future_id: number;
    result: ResMsg | ErrMsg;

    constructor(future_id: number, result: ResMsg | ErrMsg) {
        super(RPCKind.Event.FutureCompleted);
        this.future_id = future_id;
        this.result = result;
    }
}
