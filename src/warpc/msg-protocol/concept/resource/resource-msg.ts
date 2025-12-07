import type { DefMsg } from '@warpc/msg-protocol/concept/concept';

import { ConceptMsg, RefMsg } from '@warpc/msg-protocol/concept/concept';
import { ConceptKind, DefnUID } from '@warpc/msg-protocol/kinds';

export type Resource = any;
export type EncFields = Iterable<[string, any]>;
export type DecFields = Iterable<[string, any]>;

export const ANONYMOUS_CLASS = 'AnonymousClass';
export const ANONYMOUS_FUNCTION = 'AnonymousFunction';

/**
 * Base interface for all definition payloads
 */
export interface DefPayload {
    is_top_level?: boolean; // True if explicitly passed to magic(), false if discovered transitively (defaults to false)
}

/**
 * ABC for messages describing concepts that can pass through a frame by reference.
 * Resources can only be interacted with via RPC.
 */
export abstract class ResourceMsg extends ConceptMsg {
    constructor(
        public readonly kind: ConceptKind.Resource,
        public readonly uid: DefnUID,
        public readonly payload: any
    ) {
        super(kind);
    }

    abstract referentialize(): RefMsg<this>;

    get isDef(): true {
        return true;
    }
}

/**
 * A placeholder for an unfinished resource
 */
export class PlaceholderMsg extends ResourceMsg {
    constructor(
        public readonly kind: ConceptKind.Resource,
        public readonly uid: DefnUID,
        public readonly payload: any = {}
    ) {
        super(kind, uid, payload);
    }

    referentialize(): RefMsg<DefMsg> {
        return new RefMsg(this.kind, this.uid);
    }
}
