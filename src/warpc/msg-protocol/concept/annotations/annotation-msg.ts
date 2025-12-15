import { ConceptMsg, RefMsg } from '@warpc/msg-protocol/concept/concept';
import { rehydrateMsg } from '@warpc/msg-protocol/concept/rehydrate';
import { ClassMsg, ClassPayload } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionPayload } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ConceptKind, DefnUID, Membership } from '@warpc/msg-protocol/kinds';

export type Resource = any;
export type EncFields = Iterable<[string, any]>;
export type DecFields = Iterable<[string, any]>;

/**
 * ABC for messages describing concepts that can pass through a frame by reference.
 * Resources can only be interacted with via RPC.
 */
export abstract class AnnotationMsg extends ConceptMsg {
    constructor(
        public readonly kind: ConceptKind.Annotation,
        public readonly uid: DefnUID,
        public readonly payload?: any
    ) {
        super(kind);
    }

    abstract referentialize(): RefMsg<this>;

    get isDef(): true {
        return true;
    }

    // Annotation messages are never containers, primitives, or promises
    // (containers and primitives are always ClassMsg with specific system UIDs)
    isFuture(): boolean {
        return false;
    }

    isContainer(): boolean {
        return false;
    }

    isLiteral(): boolean {
        return false;
    }

    isEnum(): boolean {
        return false;
    }

    isPrimitive(): boolean {
        return false;
    }

    isObject(): boolean {
        return false;
    }

    isAny(): boolean {
        return false;
    }

    isFunction(): boolean {
        return false;
    }

    isError(): boolean {
        return false;
    }

    isAnnotation(): boolean {
        return true;
    }

    isUnion(): boolean {
        return this.kind === ConceptKind.Annotation.Union;
    }

    isIntersection(): boolean {
        return this.kind === ConceptKind.Annotation.Intersection;
    }

    isInterface(): boolean {
        return this.kind === ConceptKind.Annotation.Interface;
    }

    isMemberSig(): boolean {
        return this.kind === ConceptKind.Annotation.MemberSig;
    }

    static rehydrate(msg: AnnotationMsg | any): AnnotationMsg {
        if (msg instanceof AnnotationMsg) return msg as AnnotationMsg;
        switch ((msg as any).kind) {
            case ConceptKind.Annotation.Union:
                return new UnionMsg((msg as any).uid, (msg as any).payload);
            case ConceptKind.Annotation.Intersection:
                return new IntersectionMsg((msg as any).uid, (msg as any).payload);
            case ConceptKind.Annotation.Interface:
                return new InterfaceMsg((msg as any).uid, (msg as any).payload);
            case ConceptKind.Annotation.MemberSig:
                return new MethodSignatureMsg((msg as any).uid, (msg as any).methodOf, (msg as any).payload);
            default:
                throw new Error(`Unknown annotation kind: ${(msg as any).kind}`);
        }
    }
}

interface UnionPayload {
    classes: RefMsg<ClassMsg>[];
}

export class UnionMsg extends AnnotationMsg {
    constructor(
        uid: DefnUID,
        public readonly payload: UnionPayload
    ) {
        super(ConceptKind.Annotation.Union, uid, payload);
    }

    referentialize(): RefMsg<UnionMsg> {
        return new RefMsg(this.kind, this.uid);
    }

    static rehydrate(msg: UnionMsg | any): UnionMsg {
        const payload = { classes: (msg as any).payload.classes.map((c: any) => rehydrateMsg<RefMsg<ClassMsg>>(c)) };
        return msg instanceof UnionMsg ? msg : new UnionMsg((msg as any).uid, payload);
    }
}

interface IntersectionPayload {
    classes: RefMsg<ClassMsg>[];
}

export class IntersectionMsg extends AnnotationMsg {
    constructor(
        uid: DefnUID,
        public readonly payload: IntersectionPayload
    ) {
        super(ConceptKind.Annotation.Intersection, uid, payload);
    }

    referentialize(): RefMsg<IntersectionMsg> {
        return new RefMsg(this.kind, this.uid);
    }

    static rehydrate(msg: IntersectionMsg | any): IntersectionMsg {
        const payload = { classes: (msg as any).payload.classes.map((c: any) => rehydrateMsg<RefMsg<ClassMsg>>(c)) };
        return msg instanceof IntersectionMsg ? msg : new IntersectionMsg((msg as any).uid, payload);
    }
}

export class InterfaceMsg extends AnnotationMsg {
    constructor(
        uid: DefnUID,
        public readonly payload: ClassPayload
    ) {
        super(ConceptKind.Annotation.Interface, uid, payload);
    }

    referentialize(): RefMsg<InterfaceMsg> {
        return new RefMsg(this.kind, this.uid);
    }

    static rehydrate(msg: InterfaceMsg | any): InterfaceMsg {
        return msg instanceof InterfaceMsg ? msg : new InterfaceMsg(msg.uid, msg.payload);
    }

    asClass(): ClassMsg {
        return new ClassMsg(this.uid, this.payload);
    }
}

export class MethodSignatureMsg extends AnnotationMsg {
    constructor(
        uid: DefnUID,
        public readonly methodOf: Membership,
        public readonly payload: FunctionPayload
    ) {
        super(ConceptKind.Annotation.MemberSig, uid, payload);
    }

    referentialize(): RefMsg<MethodSignatureMsg> {
        return new RefMsg(this.kind, this.uid);
    }

    static rehydrate(msg: MethodSignatureMsg | any): MethodSignatureMsg {
        const payload = { ...msg.payload };
        payload.returnType = rehydrateMsg<RefMsg<ClassMsg>>(payload.returnType);
        return msg instanceof MethodSignatureMsg ? msg : new MethodSignatureMsg(msg.uid, msg.methodOf, payload);
    }
}
