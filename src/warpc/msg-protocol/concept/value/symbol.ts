import { ConceptKind } from '@warpc/msg-protocol/kinds';

import { ConceptMsg, RefMsg, Term } from '../concept';
import { AtomMsg, FloatMsg, IntMsg, StrMsg } from './atom';
import { ClassMsg, TypeArgument } from '../resource/class-msg';

export abstract class SymbolMsg extends ConceptMsg {
    constructor(public readonly kind: ConceptKind.SymbolAny) {
        super(kind);
    }

    referentialize(): SymbolMsg {
        return this;
    }

    get isDef(): false {
        return false;
    }
}

export class EnumValMsg extends SymbolMsg {
    constructor(
        kind: ConceptKind.Symbols.EnumVal,
        public val: StrMsg | IntMsg | FloatMsg,
        public cls: RefMsg<ClassMsg>
    ) {
        super(kind);
    }

    referentialize(): EnumValMsg {
        return this;
    }

    static rehydrate(msg: EnumValMsg | any): EnumValMsg {
        return msg instanceof EnumValMsg ? msg : new EnumValMsg(msg.kind, msg.val, msg.enumCls);
    }

    static makeTerm(val: Term, enumCls: ClassMsg): Term {
        const valMsg = findEnumVariant(val, enumCls);
        if (valMsg === undefined) {
            throw new Error(`Value ${val} of type ${typeof val} not found in enum ${enumCls.payload.name}`);
        }
        return valMsg.val;
    }
}

export function createEnumValMsg(val: any, enumCls: ClassMsg): EnumValMsg {
    const valMsg = findEnumVariant(val, enumCls);

    if (valMsg === undefined) {
        throw new Error(`Value ${val} of type ${typeof val} not found in enum ${enumCls.payload.name}`);
    }

    return new EnumValMsg(ConceptKind.Symbols.EnumVal, valMsg!, enumCls.referentialize());
}

function findEnumVariant(val: any, enumCls: ClassMsg): AtomMsg | undefined {
    for (const enumArg of enumCls.payload.supplied_type_args as TypeArgument[]) {
        const variantMsg = enumArg.type as any as AtomMsg;
        if (typeof val === 'string' && variantMsg.kind === ConceptKind.Atom.Str) {
            if (variantMsg.val === val) {
                return variantMsg;
            }
        }
        if (typeof val === 'number' && variantMsg.kind === ConceptKind.Atom.Int) {
            if (variantMsg.val === val) {
                return variantMsg;
            }
        }
    }
    return undefined;
}
