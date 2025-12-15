import { type ScopedLogger, createLogger } from '@logging/index';
import { Term } from '@warpc/msg-protocol/concept/concept';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ResourceMsg } from '@warpc/msg-protocol/concept/resource/resource-msg';
import { ConceptKind, DefnUID, World, defnUidToString } from '@warpc/msg-protocol/kinds';

import { TermDecoder } from './message-conversion/decoder';
import { UIDGenerator } from './uid-gen';

import { orUndefined } from '@/common';

export abstract class ResourceContext {
    protected messageByResource = new WeakMap<object, ResourceMsg>();
    protected uidToResource = new Map<string, any>();
    protected uidToMsg = new Map<string, ResourceMsg>(); // convenience ...
    public readonly world: World;
    public logger?: ScopedLogger;

    constructor(
        protected readonly kind: ConceptKind.Resource,
        public readonly uidGenerator: UIDGenerator,
        protected readonly parent?: ResourceContext
    ) {
        this.world = uidGenerator.world;
    }

    getAllOwnMessages(): ResourceMsg[] {
        // This disregards the parent's messages
        return [...this.uidToMsg.values()];
    }

    getMessageFromResource(resource: Term): ResourceMsg | null {
        return this.messageByResource.get(resource) || this.parent?.getMessageFromResource(resource) || null;
    }

    getMessageFromUID(uid: DefnUID): ResourceMsg | undefined {
        return orUndefined(this.uidToMsg.get(defnUidToString(uid)), this.parent?.getMessageFromUID(uid));
    }

    getResourceFromUID(uid: DefnUID): any {
        return orUndefined(this.uidToResource.get(defnUidToString(uid)), this.parent?.getResourceFromUID(uid));
    }

    setRecord(uid: DefnUID, resource: Term, message: ResourceMsg): void {
        if (resource === undefined) {
            const error = new Error(`Cannot find resource associated to message: ${JSON.stringify(message)}`);
            this.logger?.error(`Error setting context record:`, error);
            throw error;
        }
        try {
            // Some keys are invalid since they are not garbage collectible (e.g., symbol)
            this.messageByResource.set(resource, message);
        } catch {
            // Ignore WeakMap set failures for non-collectible keys
        }
        this.uidToResource.set(defnUidToString(uid), resource);
        this.uidToMsg.set(defnUidToString(uid), message);
    }

    getOrCreateResource(message: ResourceMsg, decoder: TermDecoder): any {
        const uid = message.uid;
        const cached = this.getResourceFromUID(uid);
        if (cached) return cached;

        const newResource = decoder.decodeWithCtx(message);
        this.setRecord(uid, newResource, message);
        return newResource;
    }

    updateExistingResource(uid: DefnUID, resource: any): void {
        if (this.uidToResource.has(defnUidToString(uid))) {
            this.uidToResource.set(defnUidToString(uid), resource);
        }
    }
}

export class ObjectContext extends ResourceContext {
    constructor(
        public readonly uidGenerator: UIDGenerator,
        protected readonly parent?: ResourceContext
    ) {
        super(ConceptKind.Resource.Obj, uidGenerator, parent);
        this.logger = createLogger(`context:object:${uidGenerator.world}`);
    }
}

export class ClassContext extends ResourceContext {
    constructor(
        public readonly uidGenerator: UIDGenerator,
        protected readonly parent?: ResourceContext
    ) {
        super(ConceptKind.Resource.Cls, uidGenerator, parent);
        this.logger = createLogger(`context:class:${uidGenerator.world}`);
    }

    getMessageFromUID(uid: DefnUID): ClassMsg | undefined {
        const msg = super.getMessageFromUID(uid) as ClassMsg | undefined;
        return msg;
    }

    getMessageFromClassName(name: string): ClassMsg | null {
        for (const msg of this.uidToMsg.values()) {
            if (msg.payload.name === name) {
                return msg as ClassMsg;
            }
        }
        this.logger?.error(`Class ${name} not found in context`);
        throw new Error(`Class ${name} not found in manager`);
    }
}

export class FunctionContext extends ResourceContext {
    constructor(
        public readonly uidGenerator: UIDGenerator,
        protected readonly parent?: ResourceContext
    ) {
        super(ConceptKind.Resource.Func, uidGenerator, parent);
        this.logger = createLogger(`context:function:${uidGenerator.world}`);
    }

    getMessageFromFunctionName(name: string): FunctionMsg | null {
        for (const msg of this.uidToMsg.values()) {
            if (msg.payload.name === name) {
                return msg as FunctionMsg;
            }
        }
        this.logger?.error(`Function ${name} not found in context`);
        throw new Error(`Function ${name} not found in manager`);
    }
}
