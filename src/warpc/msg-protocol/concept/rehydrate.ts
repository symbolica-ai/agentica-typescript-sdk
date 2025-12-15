import { ConceptKind } from '@warpc/msg-protocol/kinds';

import { InterfaceMsg, IntersectionMsg, MethodSignatureMsg, UnionMsg } from './annotations/annotation-msg.js';
import { RefMsg } from './concept.js';
import { ForeignExceptionMsg, InternalErrorMsg } from './exception/exception-msg.js';
import { ClassMsg } from './resource/class-msg.js';
import { FunctionMsg } from './resource/function-msg.js';
import { ObjectMsg } from './resource/object-msg.js';
import { BoolMsg, FloatMsg, IntMsg, NoneMsg, StrMsg } from './value/atom.js';
import { ArrayMsg, MapMsg, SetMsg, TupleMsg } from './value/container.js';
import { EnumValMsg } from './value/symbol.js';

export function rehydrateMsg<S>(msg: S | any): S {
    switch (msg.kind) {
        case ConceptKind.Reference.Ref:
            return RefMsg.rehydrate(msg) as S;

        // Atomic values
        case ConceptKind.Atom.None:
            return NoneMsg.rehydrate(msg) as S;
        case ConceptKind.Atom.Bool:
            return BoolMsg.rehydrate(msg) as S;
        case ConceptKind.Atom.Int:
            return IntMsg.rehydrate(msg) as S;
        case ConceptKind.Atom.Float:
            return FloatMsg.rehydrate(msg) as S;
        case ConceptKind.Atom.Str:
            return StrMsg.rehydrate(msg) as S;

        // Symbols
        case ConceptKind.Symbols.EnumVal:
            return EnumValMsg.rehydrate(msg) as S;

        // Container values
        case ConceptKind.Container.Array:
            return ArrayMsg.rehydrate(msg) as S;
        case ConceptKind.Container.Set:
            return SetMsg.rehydrate(msg) as S;
        case ConceptKind.Container.Map:
            return MapMsg.rehydrate(msg) as S;
        case ConceptKind.Container.Tuple:
            return TupleMsg.rehydrate(msg) as S;

        // Annotations
        case ConceptKind.Annotation.Union:
            return UnionMsg.rehydrate(msg) as S;
        case ConceptKind.Annotation.Intersection:
            return IntersectionMsg.rehydrate(msg) as S;
        case ConceptKind.Annotation.MemberSig:
            return MethodSignatureMsg.rehydrate(msg) as S;
        case ConceptKind.Annotation.Interface:
            return InterfaceMsg.rehydrate(msg) as S;

        // Exceptions
        case ConceptKind.Exception.Foreign:
            return ForeignExceptionMsg.rehydrate(msg) as S;
        case ConceptKind.Exception.Internal:
            return InternalErrorMsg.rehydrate(msg) as S;

        // Resources
        case ConceptKind.Resource.Cls:
            return ClassMsg.rehydrate(msg) as S;
        case ConceptKind.Resource.Func:
            return FunctionMsg.rehydrate(msg) as S;
        case ConceptKind.Resource.Obj:
            return ObjectMsg.rehydrate(msg) as S;
    }

    throw new Error(`Unknown concept message kind: ${msg.kind}`);
}
