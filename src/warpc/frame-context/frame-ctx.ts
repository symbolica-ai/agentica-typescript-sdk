import { AnnotationMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { DefMsg, NoDefMsg, RefMsg, Term } from '@warpc/msg-protocol/concept/concept';
import { ResourceMsg } from '@warpc/msg-protocol/concept/resource/resource-msg';
import { ValueMsg } from '@warpc/msg-protocol/concept/value/value-msg';
import { DefnUID, FrameID, World } from '@warpc/msg-protocol/kinds';

import { AnnotationContext } from './annotation-ctx';
import { ClassContext, FunctionContext, ObjectContext } from './resource-ctx';
import { UIDGenerator } from './uid-gen';

import { orUndefined } from '@/common';

export { SystemContext } from '@warpc/msg-protocol/concept/resource/system-msg';
export { FrameID } from '@warpc/msg-protocol/kinds';
export { AnnotationContext } from './annotation-ctx';
export { ClassContext, FunctionContext, ObjectContext, ResourceContext } from './resource-ctx';
export { UIDGenerator } from './uid-gen';

export class FrameContext {
    public readonly world: World;
    constructor(
        public readonly objects: ObjectContext,
        public readonly classes: ClassContext,
        public readonly functions: FunctionContext,
        public readonly annotations: AnnotationContext,
        public readonly uidGenerator: UIDGenerator
    ) {
        this.world = uidGenerator.world;
    }

    static newFromParent(parent: FrameContext, frameID: FrameID, uidGenerator: UIDGenerator): FrameContext {
        return new FrameContext(
            new ObjectContext(uidGenerator, parent.objects),
            new ClassContext(uidGenerator, parent.classes),
            new FunctionContext(uidGenerator, parent.functions),
            new AnnotationContext(uidGenerator, parent.annotations),
            uidGenerator
        );
    }

    getMessageFromResource(resource: Term): DefMsg | undefined {
        return (
            this.objects.getMessageFromResource(resource) ||
            this.classes.getMessageFromResource(resource) ||
            this.functions.getMessageFromResource(resource) ||
            undefined
        );
    }

    getMessageFromUID(uid: DefnUID): DefMsg | undefined {
        return orUndefined(
            this.objects.getMessageFromUID(uid),
            this.classes.getMessageFromUID(uid),
            this.functions.getMessageFromUID(uid),
            this.annotations.getRecord(uid) as DefMsg | undefined
        );
    }

    getResourceFromUID(uid: DefnUID): any | undefined {
        return orUndefined(
            this.objects.getResourceFromUID(uid),
            this.classes.getResourceFromUID(uid),
            this.functions.getResourceFromUID(uid)
        );
    }

    derefValueOrMsg(msg: NoDefMsg): DefMsg | ValueMsg {
        return msg.isRef
            ? this.getMessageFromUID((msg as RefMsg<ResourceMsg | AnnotationMsg>).uid)!
            : (msg as ValueMsg);
    }

    updateExistingResource(uid: DefnUID, resource: any): void {
        this.objects.updateExistingResource(uid, resource);
        this.classes.updateExistingResource(uid, resource);
        this.functions.updateExistingResource(uid, resource);
    }
}
