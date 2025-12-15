import { RefMsg } from '@warpc/msg-protocol/concept/concept';
import { rehydrateMsg } from '@warpc/msg-protocol/concept/rehydrate';
import { ConceptKind } from '@warpc/msg-protocol/kinds';
import { DefnUID } from '@warpc/msg-protocol/kinds';

import { ClassMsg } from './class-msg';
import { DefPayload, ResourceMsg } from './resource-msg';
import { AnnotationMsg } from '../annotations/annotation-msg';

/**
 * Payload structure for object definitions
 */
export interface ObjectPayload extends DefPayload {
    name?: string;
    cls?: RefMsg<ClassMsg | AnnotationMsg>;
    keys?: string[]; // the "dict" or "keys" on the object, esp. important if class is "Any"
    module?: string;
}

/**
 * Message describing an object resource, whose attributes and methods can be accessed via RPC.
 */
export class ObjectMsg extends ResourceMsg {
    payload: ObjectPayload;

    constructor(uid: DefnUID, payload: ObjectPayload) {
        super(ConceptKind.Resource.Obj, uid, payload);
        this.payload = payload;
    }

    static rehydrate(msg: ObjectMsg | any): ObjectMsg {
        const payload: ObjectPayload = { ...msg.payload };
        payload.cls = rehydrateMsg<RefMsg<ClassMsg>>(payload.cls);
        return msg instanceof ObjectMsg ? (msg as ObjectMsg) : new ObjectMsg(msg.uid, payload);
    }

    static createObjectRefMsg(uid: DefnUID): RefMsg<ObjectMsg> {
        return new RefMsg(ConceptKind.Resource.Obj, uid);
    }

    referentialize(): RefMsg<ObjectMsg> {
        return new RefMsg(this.kind, this.uid);
    }
}
