import { type ScopedLogger, createLogger } from '@logging/index';
import { FrameContext } from '@warpc/frame-context/frame-ctx';
import {
    ForeignExceptionMsg,
    GenericExceptionMsg,
    InternalError,
    InternalErrorMsg,
} from '@warpc/msg-protocol/concept/exception/exception-msg';
import { ClassMsg, TypeArgument } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ObjectMsg } from '@warpc/msg-protocol/concept/resource/object-msg';
import { AtomMsg } from '@warpc/msg-protocol/concept/value/atom';
import { ArrayMsg, MapMsg, SetMsg, TupleMsg } from '@warpc/msg-protocol/concept/value/container';
import { ConceptKind } from '@warpc/msg-protocol/kinds';

import { Virtualizer } from '@/warpc/frame-context/virtual-resources/virtualizer';
import { AnnotationMsg } from '@/warpc/msg-protocol/concept/annotations/annotation-msg';
import { ConceptMsg, DefMsg, RefMsg, Term } from '@/warpc/msg-protocol/concept/concept';
import { EnumValMsg } from '@/warpc/msg-protocol/concept/value/symbol';

export class TermDecoder {
    private logger: ScopedLogger;
    private errorClasses: Map<string, typeof Error> | undefined;

    constructor(
        public virtualizer: Virtualizer,
        public context: FrameContext
    ) {
        this.logger = createLogger(`decoder:${context.world}`);
    }

    decodeWithCtx(msg: ConceptMsg, expectedCls?: ClassMsg): Term | undefined {
        // Any ref must be in context (for anno return undefined)
        if (msg.kind === ConceptKind.Reference.Ref) {
            const refMsg = msg as RefMsg<DefMsg>;
            const decoded = this.context.getResourceFromUID(refMsg.uid);
            if (decoded === undefined) {
                this.logger.error(`Missing resource definition for uid=${refMsg.uid.resource}`);
                throw new Error('[AgenticaDec] Missing definition');
            }
            this.logger.debugObject(`Decoded reference to resource:`, decoded);
            return decoded;
        }

        // Otherwise decode!
        // ... use the expected class, if provided
        let kind = msg.kind;
        let suppliedTypeArgs: TypeArgument[] | undefined;
        if (expectedCls) {
            if (expectedCls.isContainer()) {
                kind = expectedCls.getContainerKind()!;
                suppliedTypeArgs = expectedCls.payload.supplied_type_args as TypeArgument[];
            }
            if (expectedCls.isPrimitive()) {
                kind = expectedCls.getPrimitiveKind()!;
            }
            if (expectedCls.isEnum()) {
                kind = ConceptKind.Symbols.EnumVal;
            }
            if (expectedCls.isFunction()) {
                kind = ConceptKind.Resource.Func;
            }
            if (expectedCls.isFuture()) {
                kind = ConceptKind.Resource.Future;
            }
            if (expectedCls.isError()) {
                kind = ConceptKind.Exception.Internal;
            }
            if (expectedCls.isObject()) {
                // pass (object might be anything due to truncation, detect at runtime!)
            }
        }

        switch (kind) {
            // Atomic values
            case ConceptKind.Atom.None:
                return null;
            case ConceptKind.Atom.Bool:
            case ConceptKind.Atom.Int:
            case ConceptKind.Atom.Float:
            case ConceptKind.Atom.Str:
                return (msg as AtomMsg).val;

            // Enum values
            case ConceptKind.Symbols.EnumVal:
                // Case 1: Expected class is provided and we got an atom
                if (ConceptKind.isAtomicMsg(msg) && expectedCls !== undefined) {
                    return EnumValMsg.makeTerm((msg as AtomMsg).val, expectedCls);
                }
                // Case 2: Msg is an enum value
                else if (msg.kind === ConceptKind.Symbols.EnumVal) {
                    const enumClsMsg =
                        expectedCls ?? this.context.classes.getMessageFromUID((msg as EnumValMsg).cls.uid);
                    if (enumClsMsg === undefined) {
                        this.logger.error(
                            `Missing enum class definition for uid=${(msg as EnumValMsg).cls.uid.resource}`
                        );
                        throw new Error('[AgenticaDec] Missing enum class definition during decoding');
                    }
                    return EnumValMsg.makeTerm((msg as EnumValMsg).val.val, enumClsMsg);
                } else {
                    throw new Error(`Reached unreachable case of enum value decoding.`);
                }

            // Container values
            case ConceptKind.Container.Array:
                return ArrayMsg.makeTerm(msg as ArrayMsg, this, suppliedTypeArgs);
            case ConceptKind.Container.Set:
                return SetMsg.makeTerm(msg as SetMsg, this, suppliedTypeArgs);
            case ConceptKind.Container.Map:
                return MapMsg.makeTerm(msg as MapMsg, this, suppliedTypeArgs);
            case ConceptKind.Container.Tuple:
                return TupleMsg.makeTerm(msg as TupleMsg, this, suppliedTypeArgs);

            // Annotations
            case ConceptKind.Annotation.Union:
            case ConceptKind.Annotation.Intersection:
            case ConceptKind.Annotation.MemberSig:
            case ConceptKind.Annotation.Interface:
                this.recordAnnotation(msg as AnnotationMsg);
                return undefined;

            // Exceptions
            case ConceptKind.Exception.Foreign:
                return this.decodeForeignException(ForeignExceptionMsg.rehydrate(msg));
            case ConceptKind.Exception.Generic:
                return this.decodeSimplifiedException(GenericExceptionMsg.rehydrate(msg));
            case ConceptKind.Exception.Internal:
                return this.decodeInternalError(InternalErrorMsg.rehydrate(msg));

            // Resources
            case ConceptKind.Resource.Cls:
                return this.decodeClass(ClassMsg.rehydrate(msg));
            case ConceptKind.Resource.Func:
                return this.decodeFunction(FunctionMsg.rehydrate(msg));
            case ConceptKind.Resource.Obj:
                return this.decodeObject(ObjectMsg.rehydrate(msg));
        }
    }

    decodeClass(msg: ClassMsg | RefMsg<ClassMsg>): any {
        this.logger.debug(`Decoding class`, msg);
        const cached = this.context.classes.getResourceFromUID(msg.uid);
        if (cached) {
            this.logger.debug(`Using cached class resource (uid=${msg.uid.resource})`);
            return cached;
        }

        if (msg.kind === ConceptKind.Reference.Ref) {
            this.logger.error(`Missing class definition for uid=${msg.uid.resource}`);
            throw new Error('[AgenticaDec] Missing definition');
        }

        const clsMsg = ClassMsg.rehydrate(msg);
        this.logger.debug(`Hydrated class`, clsMsg);
        const newClass = this.virtualizer.createVirtualClass(clsMsg);
        this.context.classes.setRecord(clsMsg.uid, newClass, clsMsg);
        this.logger.debug(`Created virtual class ${clsMsg.payload.name} (uid=${clsMsg.uid.resource})`);
        return newClass;
    }

    decodeFunction(msg: FunctionMsg | RefMsg<FunctionMsg>): any {
        const cached = this.context.functions.getResourceFromUID(msg.uid);
        if (cached) {
            this.logger.debug(`Using cached function resource (uid=${msg.uid.resource})`);
            return cached;
        }
        if (msg.isRef) {
            this.logger.error(`Missing function definition for uid=${msg.uid.resource}`);
            throw new Error('[AgenticaDec] Missing definition');
        }

        const funMsg = FunctionMsg.rehydrate(msg);
        const newFunction = this.virtualizer.createVirtualFunction(funMsg);
        this.context.functions.setRecord(funMsg.uid, newFunction, funMsg);
        this.logger.debug(`Created virtual function ${funMsg.payload.name} (uid=${funMsg.uid.resource})`);
        return newFunction;
    }

    decodeObject(msg: ObjectMsg | RefMsg<ObjectMsg>): any {
        const cached = this.context.objects.getResourceFromUID(msg.uid);
        if (cached) {
            this.logger.debug(`Using cached object resource (uid=${msg.uid.resource})`);
            return cached;
        }
        if (msg.isRef) {
            this.logger.error(`Missing object definition for uid=${msg.uid.resource}`);
            throw new Error('[AgenticaDec] Missing definition');
        }

        const objMsg = ObjectMsg.rehydrate(msg);
        const newObject = this.virtualizer.createVirtualObject(objMsg);
        this.context.objects.setRecord(objMsg.uid, newObject, objMsg);
        this.logger.debug(`Created virtual object (uid=${objMsg.uid.resource})`);
        return newObject;
    }

    decodeForeignException(msg: ForeignExceptionMsg): any {
        const excpCls = this.decodeWithCtx(msg.excp_cls);
        const excpArgs = msg.excp_args.map((arg) => this.decodeWithCtx(arg));
        this.logger.debug(`Decoded foreign exception`, excpCls, excpArgs);
        return new excpCls(...excpArgs);
    }

    decodeSimplifiedException(msg: GenericExceptionMsg): any {
        const excpCls = msg.excp_cls_name;
        const excpArgs = msg.excp_str_args;
        this.logger.debug(`Decoded simplified exception`, excpCls, excpArgs);
        if (this.errorClasses === undefined) {
            this.errorClasses = new Map<string, typeof Error>();
        }
        let errorClass: typeof Error;
        if (this.errorClasses.has(excpCls)) {
            errorClass = this.errorClasses.get(excpCls)!;
        } else {
            errorClass = class extends Error {
                constructor(...args: any[]) {
                    super(...args);
                }

                static get [Symbol.species]() {
                    return excpCls;
                }
            } as unknown as typeof Error;
            Object.defineProperty(errorClass, 'name', { value: excpCls });
        }
        return new errorClass(...excpArgs);
    }

    decodeInternalError(msg: InternalErrorMsg): any {
        return new InternalError(msg.error);
    }

    recordAnnotation(msg: AnnotationMsg): void {
        if (this.context.annotations.getRecord((msg as any).uid)) return;

        const ann = AnnotationMsg.rehydrate(msg);
        this.context.annotations.setRecord(ann.uid, ann);
    }
}
