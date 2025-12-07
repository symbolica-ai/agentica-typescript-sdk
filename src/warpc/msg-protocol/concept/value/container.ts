import type { TermDecoder } from '@warpc/frame-context/message-conversion/decoder';
import type { TermEncoder } from '@warpc/frame-context/message-conversion/encoder';

import { AnnotationMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { DefMsg, type NoDefMsg, type Term } from '@warpc/msg-protocol/concept/concept';
import { rehydrateMsg } from '@warpc/msg-protocol/concept/rehydrate';
import { ClassMsg, TypeArgument } from '@warpc/msg-protocol/concept/resource/class-msg';
import { CLASS_IDS } from '@warpc/msg-protocol/concept/resource/system-msg';
import { ValueMsg } from '@warpc/msg-protocol/concept/value/value-msg';
import { ConceptKind } from '@warpc/msg-protocol/kinds';

export class ContainerMsg extends ValueMsg {
    constructor(
        public readonly kind: ConceptKind.ContainerAny,
        public readonly val: any
    ) {
        super(kind, val);
    }

    referentialize(): NoDefMsg {
        return this;
    }
}

export class ArrayMsg extends ContainerMsg {
    constructor(public readonly val: NoDefMsg[]) {
        super(ConceptKind.Container.Array, val);
    }

    static encodeMsgRec(
        concept: Term[],
        encoder: TermEncoder,
        depth: number,
        nestedDefs: DefMsg[],
        clsMsg?: ClassMsg | AnnotationMsg
    ): ArrayMsg {
        if (clsMsg && clsMsg.payload.instance_of_generic?.resource != CLASS_IDS['Array']) {
            throw new Error("Array object doesn't have array class");
        }
        const elems: NoDefMsg[] = [];
        const elemClsUid = (clsMsg?.payload.supplied_type_args as TypeArgument[])?.find((arg) => arg.name === 'elem')
            ?.type.uid;
        if (clsMsg && !elemClsUid) {
            throw new Error('Elem class not found during array encoding');
        }
        // Use getMessageFromUID to support both ClassMsg and InterfaceMsg for element types
        const elemClsMsg = clsMsg ? encoder.context.getMessageFromUID(elemClsUid!) : undefined;
        for (const t of concept) {
            const elemMsg = encoder.encodeWithCtx(
                t,
                depth - 1,
                nestedDefs,
                elemClsMsg as ClassMsg | AnnotationMsg | undefined
            );
            elems.push(elemMsg.referentialize());
            if (elemMsg.isDef) {
                nestedDefs.push(elemMsg);
            }
        }
        return new ArrayMsg(elems);
    }

    static makeTerm(msg: ArrayMsg, decoder: TermDecoder, suppliedTypeArgs?: TypeArgument[]): Term[] {
        const elemClsUid = suppliedTypeArgs?.[0]?.type.uid;
        const elemClsMsg = elemClsUid ? decoder.context.classes.getMessageFromUID(elemClsUid) : undefined;
        return (msg.val as NoDefMsg[]).map((m) => decoder.decodeWithCtx(m, elemClsMsg));
    }

    static rehydrate(msg: ArrayMsg | any): ArrayMsg {
        return msg instanceof ArrayMsg ? msg : new ArrayMsg(msg.val.map((m: any) => rehydrateMsg(m)));
    }
}

export class SetMsg extends ContainerMsg {
    constructor(public readonly val: NoDefMsg[]) {
        super(ConceptKind.Container.Set, val);
    }

    static encodeMsgRec(
        concept: Set<Term>,
        encoder: TermEncoder,
        depth: number,
        nestedDefs: DefMsg[],
        clsMsg?: ClassMsg | AnnotationMsg
    ): SetMsg {
        if (clsMsg && clsMsg.payload.instance_of_generic?.resource != CLASS_IDS['Set']) {
            throw new Error("Set object doesn't have set class");
        }
        const vals: NoDefMsg[] = [];
        const elemClsUid = (clsMsg?.payload.supplied_type_args as TypeArgument[])?.find((arg) => arg.name === 'elem')
            ?.type.uid;
        if (clsMsg && !elemClsUid) {
            throw new Error('Element class not found during set encoding');
        }
        // Use getMessageFromUID to support both ClassMsg and InterfaceMsg for element types
        const elemClsMsg = clsMsg ? encoder.context.getMessageFromUID(elemClsUid!) : undefined;
        for (const v of concept) {
            const elemMsg = encoder.encodeWithCtx(
                v,
                depth - 1,
                nestedDefs,
                elemClsMsg as ClassMsg | AnnotationMsg | undefined
            );
            vals.push(elemMsg.referentialize());
            if (elemMsg.isDef) {
                nestedDefs.push(elemMsg);
            }
        }
        return new SetMsg(vals);
    }

    toJSON() {
        return { kind: this.kind, val: this.val };
    }

    static makeTerm(msg: SetMsg, decoder: TermDecoder, suppliedTypeArgs?: TypeArgument[]): Set<Term> {
        const elemClsUid = suppliedTypeArgs?.[0]?.type.uid;
        const elemClsMsg = elemClsUid ? decoder.context.classes.getMessageFromUID(elemClsUid) : undefined;
        const out = new Set<Term>();
        for (const m of msg.val as NoDefMsg[]) out.add(decoder.decodeWithCtx(m, elemClsMsg));
        return out;
    }

    static rehydrate(msg: SetMsg | any): SetMsg {
        return msg instanceof SetMsg ? msg : new SetMsg(msg.val.map((m: any) => rehydrateMsg(m)));
    }
}

export class MapMsg extends ContainerMsg {
    constructor(public readonly val: { keys: NoDefMsg[]; vals: NoDefMsg[] }) {
        super(ConceptKind.Container.Map, val);
    }

    static encodeMsgRec(
        concept: Map<Term, Term>,
        encoder: TermEncoder,
        depth: number,
        newDefs: DefMsg[],
        clsMsg?: ClassMsg | AnnotationMsg
    ): MapMsg {
        if (clsMsg && clsMsg.payload.instance_of_generic?.resource != CLASS_IDS['Map']) {
            throw new Error("Map object doesn't have map class");
        }
        const keys: NoDefMsg[] = [];
        const vals: NoDefMsg[] = [];
        const keyClsUid = (clsMsg?.payload.supplied_type_args as TypeArgument[])?.find((arg) => arg.name === 'key')
            ?.type.uid;
        const valueClsUid = (clsMsg?.payload.supplied_type_args as TypeArgument[])?.find((arg) => arg.name === 'value')
            ?.type.uid;
        if (clsMsg && (!keyClsUid || !valueClsUid)) {
            throw new Error('Key or value class not found during map encoding');
        }
        // Use getMessageFromUID to support both ClassMsg and InterfaceMsg for key/value types
        const keyClsMsg = clsMsg ? encoder.context.getMessageFromUID(keyClsUid!) : undefined;
        const valueClsMsg = clsMsg ? encoder.context.getMessageFromUID(valueClsUid!) : undefined;
        for (const [k, v] of concept.entries()) {
            const keyMsg = encoder.encodeWithCtx(
                k,
                depth - 1,
                newDefs,
                keyClsMsg as ClassMsg | AnnotationMsg | undefined
            );
            keys.push(keyMsg.referentialize());
            if (keyMsg.isDef) {
                newDefs.push(keyMsg);
            }
            const valMsg = encoder.encodeWithCtx(
                v,
                depth - 1,
                newDefs,
                valueClsMsg as ClassMsg | AnnotationMsg | undefined
            );
            vals.push(valMsg.referentialize());
            if (valMsg.isDef) {
                newDefs.push(valMsg);
            }
        }
        return new MapMsg({ keys: keys.map((k) => k.referentialize()), vals: vals.map((v) => v.referentialize()) });
    }

    static makeTerm(msg: MapMsg, decoder: TermDecoder, suppliedTypeArgs?: TypeArgument[]): Map<Term, Term> {
        const keyClsUid = suppliedTypeArgs?.[0]?.type.uid;
        const valueClsUid = suppliedTypeArgs?.[1]?.type.uid;
        const keyClsMsg = keyClsUid ? decoder.context.classes.getMessageFromUID(keyClsUid) : undefined;
        const valueClsMsg = valueClsUid ? decoder.context.classes.getMessageFromUID(valueClsUid) : undefined;
        const out = new Map<Term, Term>();
        const { keys, vals } = msg.val as { keys: NoDefMsg[]; vals: NoDefMsg[] };
        const n = Math.min(keys.length, vals.length);
        for (let i = 0; i < n; i++) {
            out.set(decoder.decodeWithCtx(keys[i], keyClsMsg), decoder.decodeWithCtx(vals[i], valueClsMsg));
        }
        return out;
    }

    toJSON() {
        return { kind: this.kind, val: this.val };
    }

    static rehydrate(msg: MapMsg | any): MapMsg {
        return msg instanceof MapMsg
            ? msg
            : new MapMsg({
                  keys: msg.val.keys.map((k: any) => rehydrateMsg(k)),
                  vals: msg.val.vals.map((v: any) => rehydrateMsg(v)),
              });
    }
}

export class TupleMsg extends ContainerMsg {
    constructor(public readonly val: NoDefMsg[]) {
        super(ConceptKind.Container.Tuple, val);
    }

    static encodeMsgRec(
        concept: Term[],
        encoder: TermEncoder,
        depth: number,
        nestedDefs: DefMsg[],
        clsMsg?: ClassMsg | AnnotationMsg
    ): TupleMsg {
        if (clsMsg && clsMsg.payload.instance_of_generic?.resource != CLASS_IDS['Tuple']) {
            throw new Error("Tuple object doesn't have tuple class");
        }
        const elems: NoDefMsg[] = [];
        const typeArgs = (clsMsg?.payload.supplied_type_args as TypeArgument[]) || [];

        for (let i = 0; i < concept.length; i++) {
            const elemTypeArg = typeArgs.find((arg) => arg.name === i.toString());
            const elemClsMsg = elemTypeArg ? encoder.context.getMessageFromUID(elemTypeArg.type.uid) : undefined;
            const elemMsg = encoder.encodeWithCtx(
                concept[i],
                depth - 1,
                nestedDefs,
                elemClsMsg as ClassMsg | AnnotationMsg | undefined
            );
            elems.push(elemMsg.referentialize());
            if (elemMsg.isDef) {
                nestedDefs.push(elemMsg);
            }
        }
        return new TupleMsg(elems);
    }

    static makeTerm(msg: TupleMsg, decoder: TermDecoder, suppliedTypeArgs?: TypeArgument[]): Term[] {
        return (msg.val as NoDefMsg[]).map((m, index) => {
            const elemTypeArg = suppliedTypeArgs?.[index]; // Note: this assumes correct ordering of type arguments
            const elemClsMsg = elemTypeArg
                ? decoder.context.classes.getMessageFromUID(elemTypeArg.type.uid)
                : undefined;
            return decoder.decodeWithCtx(m, elemClsMsg);
        });
    }

    static rehydrate(msg: TupleMsg | any): TupleMsg {
        return msg instanceof TupleMsg ? msg : new TupleMsg(msg.val.map((m: any) => rehydrateMsg(m)));
    }
}
