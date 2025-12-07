import type { FunctionArgument, FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';

import { InterfaceMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { NoDefMsg, RefMsg } from '@warpc/msg-protocol/concept/concept';
import { CLASS_IDS } from '@warpc/msg-protocol/concept/resource/system-msg';
import { ConceptKind, DefnUID } from '@warpc/msg-protocol/kinds';

import { DefPayload, ResourceMsg } from './resource-msg';

export interface ClassField {
    name: string;
    type: RefMsg<ClassMsg>;
    default?: NoDefMsg;
    is_private?: boolean; // private field
    is_static?: boolean; // static field
    is_optional?: boolean; // optional field
}

export interface ClassMethod {
    name: string;
    function: RefMsg<FunctionMsg>;
    is_private?: boolean; // private method
    is_static?: boolean; // static method
}

export interface TypeArgument {
    name: string;
    type: RefMsg<ClassMsg>; // Note: For Literals/Enums we hack this to allow AtomMsg // TODO: type this properly!
}

export interface ClassPayload extends DefPayload {
    name: string;
    fields: ClassField[];
    methods: ClassMethod[];
    module?: string;
    bases?: RefMsg<ClassMsg>[];
    instance_of_generic?: DefnUID;
    // partial substitution for generics (ClassMsg -> already evaluated at generation, TypeVarMsg -> evaluated at usage time
    supplied_type_args?: TypeArgument[] | FunctionMsg;
    ctor_args?: FunctionArgument[];
    doc?: string | null;
    system_resource: boolean;
    // Index signature metadata (e.g., [key: string]: number)
    index_signature?: {
        key_type: RefMsg<ClassMsg>;
        value_type: RefMsg<ClassMsg>;
        map_type: RefMsg<ClassMsg>;
    };
}

export class ClassMsg extends ResourceMsg {
    declare payload: ClassPayload;

    constructor(uid: DefnUID, payload: ClassPayload) {
        super(ConceptKind.Resource.Cls, uid, payload);
    }

    static rehydrate(msg: ClassMsg | any): ClassMsg {
        return msg instanceof ClassMsg ? (msg as ClassMsg) : new ClassMsg(msg.uid, msg.payload ?? {});
    }

    static createClassRefMsg(uid: DefnUID, system: boolean = false): RefMsg<ClassMsg> {
        return new RefMsg(ConceptKind.Resource.Cls, uid, system);
    }

    static createInterfaceMsg(uid: DefnUID, payload: ClassPayload): InterfaceMsg {
        return new InterfaceMsg(uid, payload);
    }

    referentialize(): RefMsg<ClassMsg> {
        return new RefMsg(this.kind, this.uid);
    }

    getFieldNames(): string[] {
        return this.payload.fields?.map((field: ClassField) => field.name) ?? [];
    }

    getOptionalFields(): ClassField[] {
        return this.payload.fields?.filter((field: ClassField) => field.is_optional) ?? [];
    }

    getNonOptionalFields(): ClassField[] {
        return this.payload.fields?.filter(
            (field: ClassField) => field.is_optional === false || field.is_optional === undefined
        );
    }

    getIndexSignatures(): {
        key_type: RefMsg<ClassMsg>;
        value_type: RefMsg<ClassMsg>;
        map_type: RefMsg<ClassMsg>;
    }[] {
        if (!this.payload.index_signature) return [];
        return [this.payload.index_signature];
    }

    getStaticFields(): ClassField[] {
        return this.payload.fields?.filter((field: ClassField) => field.is_static) ?? [];
    }

    getStaticFieldNames(): string[] {
        return this.getStaticFields().map((field: ClassField) => field.name);
    }

    getInstanceFields(): ClassField[] {
        return this.payload.fields?.filter((field: ClassField) => !field.is_static) ?? [];
    }

    getInstanceFieldNames(): string[] {
        return this.getInstanceFields().map((field: ClassField) => field.name);
    }

    getMethods(): Map<string, RefMsg<FunctionMsg>> {
        const result = new Map<string, RefMsg<FunctionMsg>>();
        for (const method of this.payload.methods ?? []) {
            result.set(method.name, method.function);
        }
        return result;
    }

    getMethodNames(): string[] {
        return Array.from(this.getMethods().keys());
    }

    getStaticMethods(): Map<string, RefMsg<FunctionMsg>> {
        const result = new Map<string, RefMsg<FunctionMsg>>();
        for (const method of this.payload.methods ?? []) {
            if (method.is_static) result.set(method.name, method.function);
        }
        return result;
    }

    getStaticMethodNames(): string[] {
        return Array.from(this.getStaticMethods().keys());
    }

    getInstanceMethods(): Map<string, RefMsg<FunctionMsg>> {
        const result = new Map<string, RefMsg<FunctionMsg>>();
        for (const method of this.payload.methods ?? []) {
            if (!method.is_static) result.set(method.name, method.function);
        }
        return result;
    }

    getInstanceMethodNames(): string[] {
        return Array.from(this.getInstanceMethods().keys());
    }

    getBases(): RefMsg<ClassMsg>[] {
        return this.payload.bases ?? [];
    }

    isGenericInstant(): boolean {
        return !!this.payload.instance_of_generic;
    }

    isContainer(): boolean {
        const generic = this.payload.instance_of_generic;
        return !!generic && [CLASS_IDS.Array, CLASS_IDS.Map, CLASS_IDS.Set, CLASS_IDS.Tuple].includes(generic.resource);
    }

    getContainerKind(): ConceptKind.ContainerAny | undefined {
        const generic = this.payload.instance_of_generic;
        if (!generic) return undefined;
        if (generic.resource === CLASS_IDS.Array) return ConceptKind.Container.Array;
        if (generic.resource === CLASS_IDS.Map) return ConceptKind.Container.Map;
        if (generic.resource === CLASS_IDS.Set) return ConceptKind.Container.Set;
        if (generic.resource === CLASS_IDS.Tuple) return ConceptKind.Container.Tuple;
        return undefined;
    }

    getPrimitiveKind(): ConceptKind.AtomAny | undefined {
        if (this.uid.resource === CLASS_IDS.String) return ConceptKind.Atom.Str;
        if (this.uid.resource === CLASS_IDS.Number) return ConceptKind.Atom.Float;
        if (this.uid.resource === CLASS_IDS.Boolean) return ConceptKind.Atom.Bool;
        if (this.uid.resource === CLASS_IDS.None) return ConceptKind.Atom.None;
        return undefined;
    }

    isLiteral(): boolean {
        return this.payload?.instance_of_generic?.resource === CLASS_IDS.Literal;
    }

    isEnum(): boolean {
        return this.payload?.instance_of_generic?.resource === CLASS_IDS.Enum;
    }

    isPrimitive(): boolean {
        return [CLASS_IDS.String, CLASS_IDS.Number, CLASS_IDS.Boolean, CLASS_IDS.None].includes(this.uid.resource);
    }

    isObject(): boolean {
        return this.payload?.instance_of_generic?.resource === CLASS_IDS.Object;
    }

    isAny(): boolean {
        return this.uid.resource === CLASS_IDS.Any;
    }

    isFuture(): boolean {
        return this.payload?.instance_of_generic?.resource === CLASS_IDS.Future;
    }

    isFunction(): boolean {
        return this.payload?.instance_of_generic?.resource === CLASS_IDS.Function;
    }

    isError(): boolean {
        return this.uid.resource === CLASS_IDS.Error;
    }

    isAnnotation(): boolean {
        return false;
    }

    isUnion(): boolean {
        return false;
    }

    isIntersection(): boolean {
        return false;
    }

    isInterface(): boolean {
        return false;
    }

    isMemberSig(): boolean {
        return false;
    }

    isTypeVar(): boolean {
        return false;
    }
}
