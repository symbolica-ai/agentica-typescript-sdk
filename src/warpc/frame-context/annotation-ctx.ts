import { type ScopedLogger, createLogger } from '@logging/index';
import { AnnotationMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { DefnUID, defnUidToString } from '@warpc/msg-protocol/kinds';

import { UIDGenerator } from './uid-gen';

import { orUndefined } from '@/common';

export class AnnotationContext {
    protected uidToAnnotation = new Map<string, AnnotationMsg>();
    private logger: ScopedLogger;

    constructor(
        public readonly uidGenerator: UIDGenerator,
        protected readonly parent?: AnnotationContext
    ) {
        this.logger = createLogger(`context:annotation:${uidGenerator.world}`);
    }

    getAllOwnAnnotations(): AnnotationMsg[] {
        return [...this.uidToAnnotation.values()];
    }

    getRecord(uid: DefnUID): AnnotationMsg | undefined {
        return orUndefined(this.uidToAnnotation.get(defnUidToString(uid)), this.parent?.getRecord(uid));
    }

    setRecord(uid: DefnUID, annotation: any): void {
        this.uidToAnnotation.set(defnUidToString(uid), annotation);
    }

    // Works for interfaces and method signatures
    getMessageFromAnnotationName(name: string): AnnotationMsg | null {
        for (const msg of this.uidToAnnotation.values()) {
            if (msg.payload.name === name) {
                return msg as AnnotationMsg;
            }
        }
        this.logger.error(`Annotation ${name} not found in context`);
        throw new Error(`Annotation ${name} not found in manager`);
    }
}
