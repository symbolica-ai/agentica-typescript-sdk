import type { DefMsg } from '@warpc/msg-protocol/concept/concept';

import { type ScopedLogger, createConsolaLogger } from '@logging/index';
import { getTraversalDepth } from '@transformer/transformer-config';
import { isAgenticaLibraryModule } from '@transformer/transformer-utils';
import { UnionMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { ObjectMsg } from '@warpc/msg-protocol/concept/resource/object-msg';
import { ANONYMOUS_CLASS, PlaceholderMsg } from '@warpc/msg-protocol/concept/resource/resource-msg';
import { SystemContext } from '@warpc/msg-protocol/concept/resource/system-msg';
import { ConceptKind, DefnUID, World } from '@warpc/msg-protocol/kinds';
import * as ts from 'typescript';

import { traverseThroughClass } from './class-traversal';
import { traverseThroughFunction } from './function-traversal';
import { tryGenericSystemType, tryPlainSystemType, tryPrimitiveType } from './system-traversal';
import {
    TypeSubstitutionMap,
    hasConstructor,
    isConstructorType,
    isEnum,
    substituteTypeParameter,
} from './traversal-utils';

export type TraversalRecord = {
    uid: DefnUID;
    msg: DefMsg;
    __module?: string;
    __accessorPath?: string[];
    __agenticArgumentPath?: string[]; // Only set for symbols explicitly passed to agentic()
    __agenticArgumentExpr?: ts.Expression; // Preferred: exact expression explicitly passed by user
    __isTopLevel?: boolean; // True if explicitly passed to agentic() or is the output type
    __truncated?: boolean; // True if traversal was cut short due to max depth
};

export interface TraversalCtx {
    checker: ts.TypeChecker;
    program: ts.Program;
    records: Map<DefnUID, TraversalRecord>;
    traverseTSType: (
        t: ts.Type,
        isDeeper?: boolean,
        typeNode?: ts.TypeNode,
        typeSubstitutionMap?: TypeSubstitutionMap
    ) => TraversalRecord;
    logger: ScopedLogger;
    allocateUid: () => DefnUID;
}

export class SchemaTraversal {
    recordsByUid = new Map<DefnUID, TraversalRecord>();
    recordsByType = new Map<string, TraversalRecord>();
    uidAliases = new Map<number, number>(); // Maps aliased UID → canonical UID
    static uidCounter: number = 0;
    private traversalDepth = 0;
    private readonly MAX_DEPTH: number;

    private logger: ScopedLogger;

    constructor(
        private checker: ts.TypeChecker,
        private program: ts.Program,
        parentLogger?: ScopedLogger
    ) {
        this.logger = parentLogger ? parentLogger.withScope('traverser') : createConsolaLogger('traverser');
        this.MAX_DEPTH = getTraversalDepth(program);
    }

    get traversalContext(): TraversalCtx {
        return {
            checker: this.checker,
            program: this.program,
            records: this.recordsByUid,
            logger: this.logger,
            allocateUid: () => ({ world: World.Client, resource: SchemaTraversal.uidCounter++ }),
            traverseTSType: this.traverseTSType.bind(this),
        };
    }

    startTraversalAtFunction(
        name: string,
        accessorPath: string[],
        sourceFile: string,
        t: ts.Type,
        explicitExpr?: ts.Expression
    ): TraversalRecord {
        const typeString = this.checker.typeToString(t);
        this.logger.debug(`startTraversalAtFunction: ${name}, type: ${typeString}`);

        // short-circuit if we have a record for this type
        const typeId = this.getTypeId(t);
        if (this.recordsByType.has(typeId)) {
            const record = this.recordsByType.get(typeId)!;
            record.__isTopLevel = true; // Explicitly passed to agentic()
            return record;
        }

        const uid: DefnUID = {
            world: World.Client,
            resource: SchemaTraversal.uidCounter++,
        };
        const msg = traverseThroughFunction(name, this.traversalContext, t, uid);

        const traversalRecord: TraversalRecord = {
            uid,
            msg,
            __agenticArgumentPath: accessorPath, // Explicitly passed by user
            __agenticArgumentExpr: explicitExpr,
            __module: sourceFile as string,
            __isTopLevel: true, // Explicitly passed to agentic()
        };
        this.logger.debugObject(`Finalized top-level function traversal with msg`, msg);
        this.recordsByUid.set(uid, traversalRecord);
        // Register by type so later encounters of the same function type reuse this record
        this.recordsByType.set(typeId, traversalRecord);
        return traversalRecord;
    }

    startTraversalAtClass(
        name: string,
        accessorPath: string[],
        sourceFile: string,
        t: ts.Type,
        explicitExpr?: ts.Expression
    ): TraversalRecord {
        const typeString = this.checker.typeToString(t);
        this.logger.debug(`startTraversalAtClass: ${name}, type: ${typeString}`);

        // short-circuit if we have a record for this type
        const typeId = this.getTypeId(t);
        if (this.recordsByType.has(typeId)) {
            const record = this.recordsByType.get(typeId)!;
            record.__isTopLevel = true; // Explicitly passed to agentic()
            return record;
        }

        const uid: DefnUID = {
            world: World.Client,
            resource: SchemaTraversal.uidCounter++,
        };

        // Create Placeholder for recursive traversal
        const traversalRecord = this.createTypePlaceholder(uid, typeId);

        const msg = traverseThroughClass(name, this.traversalContext, t, uid);

        traversalRecord.msg = msg;
        traversalRecord.__agenticArgumentPath = accessorPath; // Explicitly passed by user
        traversalRecord.__agenticArgumentExpr = explicitExpr;
        traversalRecord.__module = sourceFile as string;
        traversalRecord.__isTopLevel = true; // Explicitly passed to agentic()

        this.logger.debugObject(`Finalized top-level class traversal with msg`, msg);
        this.recordsByUid.set(uid, traversalRecord);
        // Register by type so later encounters (e.g., instance-derived) reuse this aliased class record
        this.recordsByType.set(typeId, traversalRecord);
        return traversalRecord;
    }

    startTraversalAtObject(
        name: string,
        accessorPath: string[],
        sourceFile: string,
        varType: ts.Type,
        explicitExpr?: ts.Expression
    ): TraversalRecord {
        const typeString = this.checker.typeToString(varType);
        this.logger.debug(`startTraversalAtObject: ${name}, type: ${typeString}, isEnum: ${isEnum(varType)}`);

        const clsRecord = this.traverseTSType(varType);
        const clsUuid = clsRecord.uid;

        // Unpeel enum wrapper: enums are technically objects, but we think of them as classes
        if (isEnum(varType)) {
            this.logger.debug(`Unpeeling enum ${name} - returning enum as class message directly`);
            clsRecord.__agenticArgumentPath = accessorPath;
            clsRecord.__agenticArgumentExpr = explicitExpr;
            clsRecord.__module = sourceFile;
            clsRecord.__isTopLevel = true;
            return clsRecord;
        }

        // Non-enum: wrap in ObjectMsg as usual
        this.logger.debug(`Wrapping non-enum ${name} in ObjectMsg`);
        const uid: DefnUID = {
            world: World.Client,
            resource: SchemaTraversal.uidCounter++,
        };
        const clsRef = ClassMsg.createClassRefMsg(clsUuid);
        const msg = new ObjectMsg(uid, { cls: clsRef, name: name, module: sourceFile });
        const traversalRecord: TraversalRecord = {
            msg,
            uid,
            __agenticArgumentPath: accessorPath,
            __agenticArgumentExpr: explicitExpr,
            __module: sourceFile,
            __isTopLevel: true,
        };
        this.logger.debugObject(`Finalized top-level object traversal with msg`, msg);
        this.recordsByUid.set(uid, traversalRecord);
        return traversalRecord;
    }

    private getTypeId(t: ts.Type): string {
        const sym = t.getSymbol();
        const anyT = t as any;
        const typeStr = this.checker.typeToString(t);

        // Normalize enum types by their declaration symbol (handles both typeof E and E)
        if (isEnum(t) && sym) {
            const enumDecl = sym.declarations?.find(ts.isEnumDeclaration);
            if (enumDecl) {
                const symbolId = (sym as any).id ?? sym.getName();
                return `enum-${symbolId}`;
            }
        }

        // For anonymous inline object types (where TypeScript creates unique symbols for each occurrence),
        // use pure structural equality to deduplicate identical types
        if (sym && (sym.getName() === '__type' || !sym.getName())) {
            return `anonType->${typeStr}`;
        }

        // For types with named symbols, use symbol ID + stringified type
        if (sym) {
            const symbolId = (sym as any).id ?? sym.getName();
            return `sym-${symbolId}:${typeStr}`;
        }

        // For anonymous object types without symbols
        if (t.flags & ts.TypeFlags.Object && !anyT.symbol) {
            return `anonType->${typeStr}`;
        }

        // For other anonymous types, use internal ID if available
        if (typeof anyT.id === 'number') {
            return `id-${anyT.id}`;
        }

        // Final fallback to stringified type
        return `anonType->${typeStr}`;
    }

    private createTypePlaceholder(uid: DefnUID, typeId: string): TraversalRecord {
        // Create a new record (placeholder to avoid infinite recursion)
        const traversalRecord: TraversalRecord = {
            uid,
            msg: new PlaceholderMsg(ConceptKind.Resource.Cls, uid),
        };
        this.logger.debug(`Created new record for complex type (uid=${uid.resource})`);
        this.recordsByType.set(typeId, traversalRecord);
        return traversalRecord;
    }

    traverseTSType(
        t: ts.Type,
        isDeeper: boolean = false,
        typeNode?: ts.TypeNode,
        typeSubstitutionMap?: TypeSubstitutionMap
    ): TraversalRecord {
        const typeString = this.checker.typeToString(t);
        this.logger.debug(`Traversing type ${typeString} at depth ${this.traversalDepth} (deepening: ${isDeeper})`);

        // Validate that the type doesn't originate from magic library modules
        const symbol = t.getSymbol();
        if (symbol?.declarations && symbol.declarations.length > 0) {
            const declaration = symbol.declarations[0];
            const sourceFile = declaration.getSourceFile();
            if (sourceFile && isAgenticaLibraryModule(sourceFile.fileName)) {
                const symbolName = symbol.getName();
                throw new Error(
                    `Cannot use type '${symbolName}' as a scope argument (or transitively through other types). ` +
                        `Types from the agentica library (spawn, agentic, Agent, etc.) cannot be passed into agent scope ` +
                        `as they need to be transformed at compile-time. \n ${sourceFile.fileName}`
                );
            }
        }

        // Check if we have class on record, and short-circuit if we do
        const typeId = this.getTypeId(t);
        if (this.recordsByType.has(typeId)) {
            const existing = this.recordsByType.get(typeId)!;

            // Re-traverse if the cached record was truncated but we're now below max depth
            const deepening = isDeeper ? 1 : 0;
            if (existing.__truncated && this.traversalDepth + deepening <= this.MAX_DEPTH) {
                const name = (existing.msg as any).payload?.name || ANONYMOUS_CLASS;
                this.logger.debug(`Re-traversing truncated record: ${name} (${typeId}), uid=${existing.uid.resource}`);
                this.recordsByType.delete(typeId);
            } else {
                const name = (existing.msg as any).payload?.name || ANONYMOUS_CLASS;
                this.logger.debug(
                    `Returning existing record (cycle or cache hit): ${name} (${typeId}), uid=${existing.uid.resource}`
                );
                return existing;
            }
        }

        // Case 1: Primitive/system atomic type
        const sysAtomMsg = tryPrimitiveType(t, this.traversalContext);
        if (sysAtomMsg) {
            const traversalRecord: TraversalRecord = {
                uid: sysAtomMsg.uid,
                msg: sysAtomMsg,
            };
            this.logger.debugObject('Returning primitive/system atomic type', sysAtomMsg);
            return traversalRecord;
        }

        // Case 2: Direct system global classes (String, Array, Error, ...) via constructor types
        const sysClassMsg = tryPlainSystemType(t, this.traversalContext);
        if (sysClassMsg) {
            const traversalRecord: TraversalRecord = {
                uid: sysClassMsg.uid,
                msg: sysClassMsg,
            };
            this.logger.debugObject('Returning direct system global class', sysClassMsg);
            return traversalRecord;
        }

        // Note: instance-side built-ins (e.g., Error instance type) should flow into complex traversal,
        // where bases and generics are handled. Only constructor types are short-circuited above.

        // Case 3: Complex type
        const uid: DefnUID = {
            world: World.Client,
            resource: SchemaTraversal.uidCounter++,
        };

        // Create Placeholder for recursive traversal
        const traversalRecord = this.createTypePlaceholder(uid, typeId);

        if (isDeeper) {
            this.traversalDepth++;
        }

        let finalizedMsg: DefMsg;
        if (this.traversalDepth > this.MAX_DEPTH) {
            this.logger.debug(`[MAXDEPTH] Max depth ${this.MAX_DEPTH} reached, returning object`);
            finalizedMsg = SystemContext.createObjectClassMsg(World.Client, uid, this.checker.typeToString(t));
            traversalRecord.__truncated = true;
        } else {
            this.logger.incDepth();
            // ... This call may recurse when going through classes
            finalizedMsg = this.traverseComplexTSType(t, uid, this.logger, typeNode, typeSubstitutionMap);
            this.logger.decDepth();
        }

        if (isDeeper) {
            this.traversalDepth--;
        }

        // Check if finalization returned a placeholder (type alias to unfinished type)
        if (finalizedMsg.constructor.name === 'PlaceholderMsg') {
            const targetUid = (finalizedMsg as any).uid.resource;
            this.logger.debug(`Type alias detected: ${uid.resource} -> ${targetUid}`);
            this.uidAliases.set(uid.resource, targetUid);
            // Remove from recordsByType - this UID is just an alias, not a real type
            this.recordsByType.delete(typeId);
            return traversalRecord;
        }

        this.logger.debugObject(`Finalized message for type ${typeString}`, finalizedMsg);
        traversalRecord.msg = finalizedMsg;

        // If the finalized message is a system resource (e.g., Error, Function), don't record it as a def
        // Return directly without adding to recordsByUid/recordsByType to avoid emitting a def
        if ((finalizedMsg as any).uid && SystemContext.getNameByUID((finalizedMsg as any).uid) !== undefined) {
            // Replace traversalRecord.uid with the system uid to be consistent
            traversalRecord.uid = (finalizedMsg as any).uid;
            // Remove the placeholder cache for this type
            this.recordsByType.delete(typeId);
            return traversalRecord;
        }

        // Update module and accessor path in traversal record
        if ((finalizedMsg as any).payload) {
            const payload: any = (finalizedMsg as any).payload;

            if (payload.module) traversalRecord.__module = payload.module;

            // Only set accessor path for runtime-accessible concepts if not already set
            // (class-traversal may have set more specific paths for methods)
            if (
                !traversalRecord.__accessorPath &&
                payload.name &&
                (finalizedMsg.kind === ConceptKind.Resource.Cls ||
                    finalizedMsg.kind === ConceptKind.Resource.Func ||
                    finalizedMsg.kind === ConceptKind.Resource.Obj)
            ) {
                traversalRecord.__accessorPath = [payload.name];
            }
        }

        this.recordsByUid.set(uid, traversalRecord);
        return traversalRecord;
    }

    traverseComplexTSType(
        t: ts.Type,
        uid: DefnUID,
        logger: ScopedLogger,
        typeNode?: ts.TypeNode,
        typeSubstitutionMap?: TypeSubstitutionMap
    ): DefMsg {
        const f = t.flags;
        const sym = t.getSymbol();

        // Handle system generics, both classes or annotation (e.g. Person[], unions, etc.)
        const systemMsg = tryGenericSystemType(this.traversalContext, t, uid, typeNode);
        if (systemMsg) {
            logger.debugObject('Built system message', systemMsg);
            return systemMsg;
        }

        // Handle function types (e.g. (arg: Person) => void)
        const callSigs = this.checker.getSignaturesOfType(t, ts.SignatureKind.Call);
        if (callSigs.length) {
            const funcMsg = traverseThroughFunction(undefined, this.traversalContext, t, uid, typeSubstitutionMap);
            logger.debugObject('Built function message', funcMsg);
            return SystemContext.createFunctionClassMsg(World.Client, uid, funcMsg);
        }

        // Handle conditional types (e.g. T extends U ? X : Y)
        if (f & ts.TypeFlags.Conditional) {
            const resolved = this.checker.getBaseConstraintOfType(t) || this.checker.getApparentType(t);
            if (resolved && resolved !== t) {
                logger.debug(`Resolving conditional type: ${this.checker.typeToString(t)}`);
                return this.traverseTSType(resolved).msg;
            }
            const conditional = t as ts.ConditionalType;
            const trueType = conditional.root.node.trueType
                ? this.checker.getTypeFromTypeNode(conditional.root.node.trueType)
                : undefined;
            const falseType = conditional.root.node.falseType
                ? this.checker.getTypeFromTypeNode(conditional.root.node.falseType)
                : undefined;
            if (trueType && falseType) {
                const trueRef = ClassMsg.createClassRefMsg(this.traverseTSType(trueType).uid);
                const falseRef = ClassMsg.createClassRefMsg(this.traverseTSType(falseType).uid);
                const unionMsg = new UnionMsg(uid, { classes: [trueRef, falseRef] });
                logger.debugObject('Built union from conditional', unionMsg);
                return unionMsg;
            }
            logger.warn(`Could not resolve conditional type: ${this.checker.typeToString(t)}`);
        }

        // Handle type parameters (e.g. T, U, B)
        if (f & ts.TypeFlags.TypeParameter) {
            const substituted = substituteTypeParameter(t, typeSubstitutionMap, this.checker);
            if (substituted) {
                logger.debug(
                    `Substituting type parameter: ${this.checker.typeToString(t)} -> ${substituted.uid.resource}`
                );
                return new PlaceholderMsg(ConceptKind.Resource.Cls, substituted.uid);
            }

            const constraint = this.checker.getBaseConstraintOfType(t);
            if (constraint && constraint !== t) {
                logger.debug(
                    `Resolving type parameter via constraint: ${this.checker.typeToString(
                        t
                    )} >>> ${this.checker.typeToString(constraint)}`
                );
                const resolvedRecord = this.traverseTSType(constraint);
                return new PlaceholderMsg(ConceptKind.Resource.Cls, resolvedRecord.uid);
            }

            const clsMsg = SystemContext.createObjectClassMsg(World.Client, uid, this.checker.typeToString(t));
            logger.debugObject('Unconstrained type parameter, fallback to object message', clsMsg);
            return clsMsg;
        }

        // Handle keyof types (e.g. keyof T)
        if (f & ts.TypeFlags.Index) {
            const indexType = t as ts.IndexType;
            const objectType = indexType.type;

            logger.debug(`Resolving keyof type: ${this.checker.typeToString(t)}`);

            // Get all property names from the object type
            const props = this.checker.getPropertiesOfType(objectType);
            const keys = props.map((p) => p.getName());

            if (keys.length > 0) {
                // Create a union of string literals for the keys
                const literalRefs = keys.map((key) => {
                    const literalType = this.checker.getStringLiteralType(key);
                    const literalUid = this.traverseTSType(literalType).uid;
                    return ClassMsg.createClassRefMsg(literalUid);
                });

                logger.debug(`keyof resolved to union of ${keys.length} string literals`);
                const unionMsg = new UnionMsg(uid, { classes: literalRefs });
                return unionMsg;
            }

            // Fallback to string type if no keys
            logger.debug('keyof has no keys, falling back to string');
            return SystemContext.getClassMsgByName(World.Client, 'string')!;
        }

        // Handle indexed access types (e.g. T["key"])
        if (f & ts.TypeFlags.IndexedAccess) {
            const resolved = this.checker.getApparentType(t);
            if (resolved && resolved !== t) {
                logger.debug(`Resolving indexed access: ${this.checker.typeToString(t)}`);
                const resolvedRecord = this.traverseTSType(resolved);
                // Return a placeholder to create an alias relationship
                return new PlaceholderMsg(ConceptKind.Resource.Cls, resolvedRecord.uid);
            }
        }

        // Handle substitution types (from generic instantiation)
        if (f & ts.TypeFlags.Substitution) {
            const substitution = t as ts.SubstitutionType;
            logger.debug(`Resolving substitution type: ${this.checker.typeToString(t)}`);
            return this.traverseTSType(substitution.baseType).msg;
        }

        logger.debug(`Type flags: ${f}, has symbol: ${!!sym}`);

        // Handle custom classes or annotations (e.g. interface Person {})
        if (f & ts.TypeFlags.Object || sym) {
            // First: avoid defining system non-generic interface types (e.g., Error, Function)
            const symName = sym?.getName();
            const hasCtor = hasConstructor(t);
            const maybeRef = t as ts.TypeReference;
            const hasTypeArgs = !!(maybeRef as any).typeArguments?.length;
            const symHasTypeParams = !!(sym as any)?.typeParameters?.length;
            const isGenericInterface = hasTypeArgs || symHasTypeParams;
            if (symName && !hasCtor && !isGenericInterface && SystemContext.isSystemResourceName(symName)) {
                const sysMsg = SystemContext.getClassMsgByName(World.Client, symName)!;
                logger.debugObject('Returning system non-generic interface as class msg', sysMsg);
                return sysMsg;
            }

            // Detect constructor types via construct signatures
            // Comment: this omits the actual type structures that a usual `typeof MyClass` would enforce in TS
            if (isConstructorType(t, this.checker)) {
                logger.debug('Building a type of type msgs (type info ignored)');
                return SystemContext.getClassMsgByName(World.Client, 'TYPE')!;
            }

            const classMsg = traverseThroughClass(undefined, this.traversalContext, t, uid);
            logger.debugObject('Built class message', classMsg);
            return classMsg;
        }

        logger.warn(`Unknown type: ${this.checker.typeToString(t)}`);

        // Fallback to "any" type (with name of the type t)
        const clsMsg = SystemContext.createObjectClassMsg(World.Client, uid, this.checker.typeToString(t));
        logger.debugObject('Fallback to any class message', clsMsg);

        return clsMsg;
    }
}
