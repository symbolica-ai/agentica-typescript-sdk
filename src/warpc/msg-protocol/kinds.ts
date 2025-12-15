import type { AnnotationMsg } from './concept/annotations/annotation-msg';
import type { ConceptMsg } from './concept/concept';
import type { ResourceMsg } from './concept/resource/resource-msg';
import type { AtomMsg } from './concept/value/atom';
import type { ContainerMsg } from './concept/value/container';

export enum World {
    Client = 'client',
    Server = 'server',
}
export type FrameID = number;
export type FrameUID = { world: World; frame: FrameID };
export type DefnID = number;
export type DefnUID = { world: World; resource: DefnID; py_world?: number; py_resource?: number; py_frame?: number };

// Kinds of messages representing concepts
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ConceptKind {
    // Atomic values
    export enum Atom {
        Str = 'str',
        Bytes = 'bytes',
        Float = 'float',
        Int = 'int',
        None = 'none',
        Bool = 'bool',
    }
    // Container values
    export enum Container {
        Array = 'array',
        Set = 'set',
        Map = 'map',
        Tuple = 'tuple', // a.k.a. "fixed length heterogenous array" / "untagged tuple"
        Exception = 'excp',
    }
    // Resources
    export enum Resource {
        Cls = 'cls',
        Func = 'func',
        Obj = 'obj',
        Future = 'future',
    }
    // Reference
    export enum Reference {
        Ref = 'ref',
    }
    // Annotations
    export enum Annotation {
        Union = 'union',
        Intersection = 'intersection',
        MemberSig = 'methodsig',
        Interface = 'interface',
    }
    // Exceptions
    export enum Exception {
        Foreign = 'foreign_excp',
        Internal = 'internal_error',
        Generic = 'generic_excp',
    }

    // Symbols
    export enum Symbols {
        EnumVal = 'enum_val',
        EnumKey = 'enum_key', // Note: Not useful in TS
    }

    export type Any = Atom | Container | Resource | Annotation | Reference | Exception | Symbols;

    export type AnnotationAny =
        | Annotation.Union
        | Annotation.Intersection
        | Annotation.MemberSig
        | Annotation.Interface;
    export type ResourceAny = Resource.Cls | Resource.Func | Resource.Obj | Resource.Future;
    export type AtomAny = Atom.Str | Atom.Bytes | Atom.Float | Atom.Int | Atom.None | Atom.Bool;
    export type SymbolAny = Symbols.EnumVal | Symbols.EnumKey;
    export type ContainerAny = Container.Array | Container.Set | Container.Map | Container.Tuple | Container.Exception;
    export type ValueAny = AtomAny | ContainerAny | SymbolAny;
    export type ExceptionAny = Exception.Foreign | Exception.Internal | Exception.Generic;
    export type TermAny = ValueAny | ContainerAny | ResourceAny | AnnotationAny | ExceptionAny;

    export function fromStr(kind: string): Any | undefined {
        switch (kind) {
            case 'cls':
                return Resource.Cls;
            case 'func':
                return Resource.Func;
            case 'obj':
                return Resource.Obj;
            case 'union':
                return Annotation.Union;
            case 'intersection':
                return Annotation.Intersection;
            case 'methodsig':
                return Annotation.MemberSig;
            case 'interface':
                return Annotation.Interface;
        }
        return undefined;
    }

    export function isResourceMsg(msg: ConceptMsg): msg is ResourceMsg {
        return Object.values(Resource).includes(msg?.kind as Resource);
    }

    export function isAnnotationMsg(msg: ConceptMsg): msg is AnnotationMsg {
        return Object.values(Annotation).includes(msg.kind as Annotation);
    }

    export function isAtomicMsg(msg: ConceptMsg): msg is AtomMsg {
        return Object.values(Atom).includes(msg.kind as Atom);
    }

    export function isContainerMsg(msg: ConceptMsg): msg is ContainerMsg {
        return Object.values(Container).includes(msg.kind as Container);
    }
}

// Kinds of messages representing requests
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace RPCKind {
    export enum Event {
        FutureCanceled = 'future_canceled',
        FutureCompleted = 'future_completed',
    }

    export enum Request {
        Init = 'init',
        Call = 'callfun',
        CallMethod = 'callmethod',
        New = 'new',
        Exec = 'exec',
        HasAttr = 'hasattr',
        GetAttr = 'getattr',
        SetAttr = 'setattr',
        DelAttr = 'delattr',
        InstanceOf = 'instanceof',
    }

    export enum Response {
        Ok = 'ok',
        Err = 'err',
        Res = 'result',
    }

    export type ResponseAny = Response.Ok | Response.Err | Response.Res;
    export type RequestAny =
        | Request.Init
        | Request.Call
        | Request.CallMethod
        | Request.New
        | Request.Exec
        | Request.HasAttr
        | Request.GetAttr
        | Request.SetAttr
        | Request.DelAttr
        | Request.InstanceOf;

    export type EventAny = Event.FutureCanceled | Event.FutureCompleted;
    export type RpcAny = RequestAny | ResponseAny | EventAny;

    export function isRequest(kind: RpcAny): kind is RequestAny {
        return Object.values(Request).includes(kind as Request);
    }

    export function isResponse(kind: RpcAny): kind is ResponseAny {
        return Object.values(Response).includes(kind as Response);
    }
}

export function defnUidToString(uid: DefnUID): string {
    return `${uid.world}:${uid.resource}`;
}

export interface BaseMsg {
    readonly kind: string;
}

export abstract class Msg implements BaseMsg {
    abstract readonly kind: string;
}

export type Membership = { uid: DefnUID; kind: 'static' | 'instance' };
