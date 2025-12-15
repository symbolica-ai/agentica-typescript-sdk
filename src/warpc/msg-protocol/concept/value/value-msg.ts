import { ConceptMsg } from '@warpc/msg-protocol/concept/concept';
import { ConceptKind } from '@warpc/msg-protocol/kinds';

export abstract class ValueMsg extends ConceptMsg {
    constructor(
        kind: ConceptKind.ValueAny,
        public readonly val: any
    ) {
        super(kind);
    }

    get isDef(): false {
        return false;
    }
}
