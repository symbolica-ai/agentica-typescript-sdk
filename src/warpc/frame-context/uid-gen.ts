import type { DefnUID, World } from '@warpc/msg-protocol/kinds';

/**
 * UID generator for creating new resource IDs
 * User types start at 0, system types use negative IDs
 */
export class UIDGenerator {
    private currentID: number;

    constructor(
        public world: World,
        startID?: number
    ) {
        this.currentID = startID ?? 0;
    }

    next(): DefnUID {
        this.currentID += 1;
        return { world: this.world, resource: this.currentID };
    }

    setmin(id: number): void {
        if (id > this.currentID) this.currentID = id;
    }

    // In the async model we keep a single generator per runtime; sharing simply returns itself.
    share(): UIDGenerator {
        return this;
    }
}
