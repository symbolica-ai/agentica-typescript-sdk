import type { ClassMsg } from './class-msg';
import type { NoDefMsg } from '@warpc/msg-protocol/concept/concept';

import { TermEncoder } from '@warpc/frame-context/message-conversion/encoder';
import { MethodSignatureMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { RefMsg } from '@warpc/msg-protocol/concept/concept';
import { ConceptKind, DefnUID, Membership } from '@warpc/msg-protocol/kinds';

import { ANONYMOUS_FUNCTION, DefPayload, Resource, ResourceMsg } from './resource-msg.js';
import { SystemMagicContext } from './system-msg';

export interface FunctionArgument {
    name: string;
    type: RefMsg<ClassMsg>;
    optional?: boolean;
    default?: NoDefMsg;
    rest?: boolean; // true if this is a rest parameter (...args)
}

export interface FunctionPayload extends DefPayload {
    name: string;
    doc?: string | null;
    arguments?: FunctionArgument[];
    returnType?: RefMsg<ClassMsg>;
    module?: string;
}

export class FunctionMsg extends ResourceMsg {
    constructor(uid: DefnUID, payload?: FunctionPayload) {
        super(ConceptKind.Resource.Func, uid, payload);
    }

    static rehydrate(msg: FunctionMsg | any): FunctionMsg {
        return msg instanceof FunctionMsg
            ? (msg as FunctionMsg)
            : new FunctionMsg((msg as any).uid, (msg as any).payload ?? {});
    }

    static makeMessage(resource: Resource, encoder: TermEncoder, depth: number, uid: DefnUID): FunctionMsg {
        const name = resource.name || ANONYMOUS_FUNCTION;
        const src = Function.prototype.toString.call(resource);
        const argsMatch = src.match(/^[\s\S]*?\(([^)]*)\)/);
        const argNames =
            argsMatch && argsMatch[1].trim()
                ? argsMatch[1]
                      .split(',')
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                : [];

        // At runtime, function is assumed to take in `Object`s (best effort in JS)
        const anyClass = SystemMagicContext.getClassRefByName(encoder.context.world, 'Object')!;
        const argumentsList = argNames.map((n) => ({
            name: n,
            type: anyClass,
        }));
        const payload: FunctionPayload = {
            name,
            arguments: argumentsList as any,
            returnType: anyClass,
            module: resource.module,
        };

        return new FunctionMsg(uid, payload);
    }

    static createFunctionRefMsg(uid: DefnUID): RefMsg<FunctionMsg> {
        return new RefMsg(ConceptKind.Resource.Func, uid);
    }

    toMethodSignature(methodOf: Membership): MethodSignatureMsg {
        return new MethodSignatureMsg(this.uid, methodOf, this.payload);
    }

    referentialize(): RefMsg<FunctionMsg> {
        return new RefMsg(this.kind, this.uid);
    }
}
