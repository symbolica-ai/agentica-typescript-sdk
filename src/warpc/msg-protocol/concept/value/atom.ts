import { ValueMsg } from '@warpc/msg-protocol/concept/value/value-msg';
import { ConceptKind } from '@warpc/msg-protocol/kinds';

export abstract class AtomMsg extends ValueMsg {
    constructor(kind: ConceptKind.AtomAny, val: any) {
        super(kind, val);
    }

    referentialize(): ValueMsg {
        return this;
    }
}

export class NoneMsg extends AtomMsg {
    readonly val = null;

    constructor() {
        super(ConceptKind.Atom.None, null);
    }

    static rehydrate(msg: NoneMsg | any): NoneMsg {
        return msg instanceof NoneMsg ? msg : new NoneMsg();
    }
}

export class BoolMsg extends AtomMsg {
    constructor(public readonly val: boolean) {
        super(ConceptKind.Atom.Bool, val);
    }

    static rehydrate(msg: BoolMsg | any): BoolMsg {
        return msg instanceof BoolMsg ? msg : new BoolMsg(msg.val);
    }
}

export class IntMsg extends AtomMsg {
    constructor(public readonly val: number | bigint) {
        super(ConceptKind.Atom.Int, val);
    }

    static rehydrate(msg: IntMsg | any): IntMsg {
        return msg instanceof IntMsg ? msg : new IntMsg(msg.val);
    }
}

export class FloatMsg extends AtomMsg {
    constructor(public readonly val: number) {
        super(ConceptKind.Atom.Float, val);
    }

    static rehydrate(msg: FloatMsg | any): FloatMsg {
        return msg instanceof FloatMsg ? msg : new FloatMsg(msg.val);
    }
}

export class StrMsg extends AtomMsg {
    constructor(public readonly val: string) {
        super(ConceptKind.Atom.Str, val);
    }

    static rehydrate(msg: StrMsg | any): StrMsg {
        return msg instanceof StrMsg ? msg : new StrMsg(msg.val);
    }
}

export function createAtomMsg(val: any): AtomMsg {
    if (val === null || val === undefined) return new NoneMsg();
    if (typeof val === 'boolean') return new BoolMsg(val);
    if (typeof val === 'number') {
        return Number.isInteger(val) ? new IntMsg(val) : new FloatMsg(val);
    }
    if (typeof val === 'string') return new StrMsg(val);
    if (typeof val === 'bigint') return new IntMsg(val);
    throw new Error(`Cannot create atom message for: ${typeof val}`);
}
