import { Frame } from '@warpc/frame';
import { FrameContext } from '@warpc/frame-context/frame-ctx';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ObjectMsg } from '@warpc/msg-protocol/concept/resource/object-msg';
import { DefnUID } from '@warpc/msg-protocol/kinds';
import { RpcHandler } from '@warpc/rpc-channel/handler';

/**
 * Interface for virtual resource hooks - provides callback functions for virtual behavior
 */
export abstract class Virtualizer {
    constructor(
        public readonly dispatcher: VirtualDispatcher,
        public readonly manager: FrameContext
    ) {}

    // Virtual class creation
    abstract createVirtualClass(msg: ClassMsg): any;

    // Virtual function creation
    abstract createVirtualFunction(msg: FunctionMsg): any;

    // Virtual object creation and manipulation
    abstract createVirtualObject(msg: ObjectMsg): any;
}

export abstract class VirtualDispatcher {
    public handler: RpcHandler | null = null;
    public owner: Frame;

    constructor(owner: Frame) {
        this.owner = owner;
    }

    abstract setRpcHandler(handler: RpcHandler): void;
    abstract virtualNew(uid: DefnUID, args: any[], systemResource: boolean): Promise<any>;
    abstract virtualFunctionCall(uid: DefnUID, args: any[]): Promise<any>;
    abstract virtualMethodCall(uid: DefnUID, methodname: string, args: any[]): Promise<any>;
    abstract virtualSetAttr(uid: DefnUID, name: string, value: any): Promise<void>;
    abstract virtualGetAttr(uid: DefnUID, name: string): Promise<any>;
    abstract virtualHasAttr(uid: DefnUID, name: string): Promise<boolean>;
    abstract virtualDelAttr(uid: DefnUID, name: string): Promise<void>;
}
