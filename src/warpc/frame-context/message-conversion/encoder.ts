import { type ScopedLogger, createLogger } from '@logging/index';
import { FrameContext } from '@warpc/frame-context/frame-ctx';
import { DefMsg, Term, TermMsg } from '@warpc/msg-protocol/concept/concept';
import { ClassField, ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ObjectMsg } from '@warpc/msg-protocol/concept/resource/object-msg';
import { CLASS_IDS, SystemMagicContext } from '@warpc/msg-protocol/concept/resource/system-msg';
import { createAtomMsg } from '@warpc/msg-protocol/concept/value/atom';
import { ArrayMsg, MapMsg, SetMsg, TupleMsg } from '@warpc/msg-protocol/concept/value/container';
import { ConceptKind, DefnUID } from '@warpc/msg-protocol/kinds';

import { AnnotationMsg } from '@/warpc/msg-protocol/concept/annotations/annotation-msg';
import { GenericExceptionMsg } from '@/warpc/msg-protocol/concept/exception/exception-msg';
import { createEnumValMsg } from '@/warpc/msg-protocol/concept/value/symbol';

export class TermEncoder {
    private logger: ScopedLogger;

    constructor(public readonly context: FrameContext) {
        this.logger = createLogger(`encoder:${context.world}`);
    }

    /*
    Encodes and extends contexts recursively.
    (NestedDefs keep track of recursively nested defs)
    */
    encodeWithCtx(
        concept: Term,
        depth: number = -1, // -1 means no depth limit
        nestedDefs: DefMsg[] = [],
        clsMsg?: ClassMsg | AnnotationMsg
    ): TermMsg {
        const cached = this.context.getMessageFromResource(concept);
        if (cached) {
            this.logger.debug(`Using cached message`);
            return cached as TermMsg;
        }

        /* NULL/UNDEFINED DETECTION */
        if (concept === null || concept === undefined) {
            return createAtomMsg(concept);
        }

        // Ignore primitive and object types (never want to send those -> let encoder handle what to send)
        if (clsMsg?.isPrimitive() || clsMsg?.isObject() || clsMsg?.isAny()) {
            clsMsg = undefined;
        }

        /* ENUM VALUE DETECTION */
        if (clsMsg?.isEnum()) {
            return createEnumValMsg(concept, clsMsg as ClassMsg);
        }

        /* ATOM VALUE DETECTION */
        if (
            typeof concept === 'boolean' ||
            typeof concept === 'number' ||
            typeof concept === 'bigint' ||
            typeof concept === 'string'
        ) {
            return createAtomMsg(concept);
        }

        /* FUNCTION AND CONSTRUCTOR DETECTION */
        if (typeof concept === 'function') {
            if (concept.toString().startsWith('class')) {
                const baseCls = clsMsg as ClassMsg | AnnotationMsg;
                const classMsg = this.encodeClass(concept, undefined, depth, nestedDefs, baseCls);
                return classMsg;
            }
            return this.encodeFunction(concept, undefined);
        }

        /* CONTAINER DETECTION */
        // (the container case may recurse)
        if (
            Array.isArray(concept) &&
            depth != 0 &&
            (isSysResource(clsMsg, 'Array') || isSysResource(clsMsg, 'Tuple'))
        ) {
            if (isSysResource(clsMsg, 'Tuple')) {
                this.logger.debug('Encoding tuple');
                return TupleMsg.encodeMsgRec(concept, this, depth, nestedDefs, clsMsg);
            }
            this.logger.debug('Encoding array');
            return ArrayMsg.encodeMsgRec(concept, this, depth, nestedDefs, clsMsg);
        }
        if (concept instanceof Set && depth != 0 && isSysResource(clsMsg, 'Set')) {
            this.logger.debug('Encoding set');
            return SetMsg.encodeMsgRec(concept as Set<any>, this, depth, nestedDefs, clsMsg);
        }
        if (concept instanceof Map && depth != 0 && isSysResource(clsMsg, 'Map')) {
            this.logger.debug('Encoding map');
            return MapMsg.encodeMsgRec(concept as Map<any, any>, this, depth, nestedDefs, clsMsg);
        }

        /* EXCEPTION DETECTION */
        if (concept instanceof Error && !clsMsg) {
            this.logger.debug('Encoding error');
            return GenericExceptionMsg.makeFromError(concept);
        }

        /* ANNOTATION HANDLING */
        if (!!clsMsg && ConceptKind.isAnnotationMsg(clsMsg)) {
            this.logger.debug('Encoding annotated object');
            const objMsg = this.tryEncodeAnnotatedObject(
                concept,
                undefined,
                depth,
                nestedDefs,
                clsMsg as AnnotationMsg
            );
            if (objMsg) {
                // Overwrite
                this.context.objects.setRecord(objMsg.uid, concept, objMsg);
                return objMsg;
            }
        }

        /* FALLBACK */
        this.logger.debug('Encoding bare object');
        return this.encodeObject(concept, undefined, depth, clsMsg as ClassMsg);
    }

    encodeClass(
        cls: Term,
        reuseUid?: DefnUID | undefined,
        depth: number = -1,
        nestedDefs: DefMsg[] = [],
        baseCls?: ClassMsg | AnnotationMsg
    ): ClassMsg {
        const cached = this.context.classes.getMessageFromResource(cls);
        // Skip cache if we are forcing a UID
        if (cached && reuseUid === undefined) {
            this.logger.debug(`Using cached class message for ${(cached as ClassMsg).payload.name}`);
            return cached as ClassMsg;
        }
        const uid = reuseUid ?? this.context.uidGenerator.next();

        // Runtime class encoding
        const objectType = SystemMagicContext.getClassRefByName(this.context.world, 'Object')!;
        const fields: ClassField[] = [];
        const methods: any[] = [];

        if (cls.prototype) {
            const propNames = extractAllPropertyNames(cls.prototype);
            this.logger.warn(
                `Encoding class ${cls.name} at runtime. For proper type information, please pass the class directly.`
            );
            for (const name of propNames) {
                let propValue: unknown;
                try {
                    propValue = cls.prototype[name];
                } catch {
                    continue;
                }
                if (typeof propValue === 'function') {
                    const funcUid = this.context.uidGenerator.next();
                    const methodSigMsg = FunctionMsg.makeMessage(propValue, this, depth, funcUid).toMethodSignature({
                        uid,
                        kind: 'instance',
                    });
                    this.logger.debug(`Encoded method ${name} (uid=${methodSigMsg.uid.resource})`);
                    this.context.annotations.setRecord(methodSigMsg.uid, methodSigMsg);
                    nestedDefs.push(methodSigMsg);
                    methods.push({ name, function: methodSigMsg.referentialize() });
                } else {
                    fields.push({ name, type: objectType });
                }
            }
        }

        const msg = new ClassMsg(uid, {
            name: cls.name,
            bases: baseCls && !baseCls.isUnion() ? [baseCls.referentialize()] : [], // NOTE: unions cannot be bases
            fields,
            methods,
            system_resource: false,
        });

        // This wasn't cached so add it to nested defs
        nestedDefs.push(msg);

        this.context.classes.setRecord(uid, cls, msg);
        this.logger.debug(`Encoded class ${msg.payload.name} (uid=${uid.resource})`);
        return msg;
    }

    encodeFunction(fun: Term, reuseUid?: DefnUID | undefined): FunctionMsg {
        const cached = this.context.functions.getMessageFromResource(fun);
        // Skip cache if we are re-encoding (re-using UID)
        if (cached && reuseUid === undefined) {
            this.logger.debug(`Using cached function message`);
            return cached as FunctionMsg;
        }
        const uid = reuseUid ?? this.context.uidGenerator.next();
        const msg = FunctionMsg.makeMessage(fun, this, 0, uid);
        this.context.functions.setRecord(uid, fun, msg);
        this.logger.debug(`Encoded function ${msg.payload.name} (uid=${uid.resource})`);
        return msg;
    }

    tryEncodeAnnotatedObject(
        obj: Term,
        reuseUid?: DefnUID | undefined,
        depth: number = -1,
        nestedDefs: DefMsg[] = [],
        annoMsg?: AnnotationMsg | ClassMsg,
        syntheticClass: boolean = false
    ): ObjectMsg | undefined {
        if (!annoMsg) {
            return undefined;
        }

        if (annoMsg.isUnion()) {
            const actualClsMsg = this.tryConcretizeClsOfObj(obj, depth, annoMsg, nestedDefs);
            const rawObjMsg = this.encodeObject(obj, reuseUid, depth, actualClsMsg, nestedDefs);
            return rawObjMsg;
        }

        if (annoMsg.isIntersection()) {
            const actualClsMsg = this.tryConcretizeClsOfObj(obj, depth, annoMsg, nestedDefs);
            const rawObjMsg = this.encodeObject(obj, reuseUid, depth, actualClsMsg, nestedDefs);
            return rawObjMsg;
        }

        if (annoMsg.isInterface()) {
            const actualClsMsg = this.tryConcretizeClsOfObj(obj, depth, annoMsg, nestedDefs);
            const rawObjMsg = this.encodeObject(obj, reuseUid, depth, actualClsMsg, nestedDefs);
            return rawObjMsg;
        }

        if (syntheticClass) {
            const actualClsMsg = this.tryConcretizeClsOfObj(obj, depth, annoMsg, nestedDefs);
            const rawObjMsg = this.encodeObject(obj, reuseUid, depth, actualClsMsg, nestedDefs);
            return rawObjMsg;
        }

        return undefined;
    }

    tryConcretizeClsOfObj(
        obj: Term,
        depth: number = -1,
        abstractCls: ClassMsg | AnnotationMsg,
        nestedDefs: DefMsg[] = []
    ): ClassMsg | AnnotationMsg {
        let actualClsMsg: ClassMsg | undefined = undefined;
        if (!!obj.constructor && obj.constructor !== Object) {
            const cachedClsMsg = this.context.classes.getMessageFromUID(obj.constructor);
            if (!cachedClsMsg) {
                actualClsMsg = this.encodeClass(obj.constructor, undefined, depth, nestedDefs, abstractCls);
                nestedDefs.push(actualClsMsg);
            } else {
                actualClsMsg = cachedClsMsg;
            }
        }
        return actualClsMsg ? actualClsMsg : abstractCls;
    }

    encodeObject(
        obj: Term,
        reuseUid: DefnUID | undefined,
        depth: number = -1,
        clsMsg?: ClassMsg | AnnotationMsg,
        nestedDefs: DefMsg[] = []
    ): ObjectMsg {
        const cached = this.context.objects.getMessageFromResource(obj);
        // Skip cache if we are re-encoding (re-using UID)
        if (cached && reuseUid === undefined) {
            this.logger.debug(`Using cached object message`);
            return cached as ObjectMsg;
        }
        const uid = reuseUid ?? this.context.uidGenerator.next();

        if (!clsMsg) {
            if ((obj as any).constructor) {
                clsMsg = this.encodeClass((obj as any).constructor, undefined, depth, nestedDefs);
            } else {
                // No constructor -> Any
                clsMsg = SystemMagicContext.createAnyClassMsg(this.context.world, uid);
            }
        }

        const msg = new ObjectMsg(uid, {
            cls: clsMsg.referentialize(),
            keys: Array.from(extractAllPropertyNames(obj)),
        });

        this.context.objects.setRecord(uid, obj, msg);
        this.logger.debug(`Encoded object (uid=${uid.resource}, depth=${depth})`);
        return msg;
    }

    encodeAnnotation(_manager: FrameContext, _depth: number): FunctionMsg {
        throw new Error('Cannot runtime encode annotation');
    }
}

export function extractAllPropertyNames(concept: any): Set<string> {
    // This appears to be necessary because we currently have a _separate_ path
    // for class constructors, so we must not send these as keys.
    const allProps = new Set<string>();
    const excludedProps = new Set(['constructor', '__proto__', 'prototype']);

    for (let obj = concept; obj && obj !== Object.prototype; obj = Object.getPrototypeOf(obj)) {
        Object.getOwnPropertyNames(obj).forEach((p) => {
            if (!excludedProps.has(p)) {
                allProps.add(p);
            }
        });
    }
    return allProps;
}

function isSysResource(clsMsg: ClassMsg | AnnotationMsg | undefined, resource: string): boolean {
    if (clsMsg === undefined) return true;
    return clsMsg.payload.instance_of_generic?.resource === CLASS_IDS[resource];
}
