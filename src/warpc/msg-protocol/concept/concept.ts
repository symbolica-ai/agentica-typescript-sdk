import type { ResourceMsg } from './resource/resource-msg';

import { ConceptKind, DefnUID, Msg } from '@warpc/msg-protocol/kinds';

import { type AnnotationMsg } from './annotations/annotation-msg';
import { type ForeignExceptionMsg, type GenericExceptionMsg, type InternalErrorMsg } from './exception/exception-msg';
import { SymbolMsg } from './value/symbol';
import { ValueMsg } from './value/value-msg';

export type Term = any;

export abstract class ConceptMsg extends Msg {
    constructor(public readonly kind: ConceptKind.Any) {
        super();
    }

    // Override in subclasses
    get isRef(): boolean {
        return this.kind === ConceptKind.Reference.Ref;
    }

    // Override in subclasses
    get isDef(): boolean {
        return false;
    }

    abstract referentialize(): NoDefMsg;

    static rehydrate(msg: ConceptMsg | any): ConceptMsg {
        return msg instanceof ConceptMsg ? msg : new msg(msg.kind);
    }
}

export function equalUid(uid1: DefnUID, uid2: DefnUID): boolean {
    return uid1.world === uid2.world && uid1.resource === uid2.resource;
}

export type DefMsg = ResourceMsg | AnnotationMsg;
export type ExceptionMsg = ForeignExceptionMsg | InternalErrorMsg | GenericExceptionMsg;
export type NoDefMsg = RefMsg<DefMsg> | ValueMsg | ExceptionMsg | SymbolMsg;
export type TermMsg = DefMsg | ValueMsg | ExceptionMsg | SymbolMsg;

export class RefMsg<MsgType extends DefMsg> extends ConceptMsg {
    declare kind: ConceptKind.Reference;

    constructor(
        public readonly refKind: ConceptKind.Any,
        public readonly uid: DefnUID,
        public readonly system: boolean = false
    ) {
        super(ConceptKind.Reference.Ref);
    }

    get isRef(): true {
        return true;
    }

    get isDef(): false {
        return false;
    }

    referentialize(): RefMsg<MsgType> {
        return this;
    }

    static rehydrate<T extends DefMsg>(msg: RefMsg<T> | any): RefMsg<T> {
        return msg instanceof RefMsg ? msg : new RefMsg(msg.refKind, msg.uid);
    }
}

export function resolveAliasedRefMsg(msg: RefMsg<DefMsg>, aliasedUid: DefnUID): RefMsg<DefMsg> {
    return new RefMsg(msg.refKind, aliasedUid);
}
