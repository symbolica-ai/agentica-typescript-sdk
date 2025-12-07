import { AnnotationMsg, IntersectionMsg, UnionMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { SystemMagicContext } from '@warpc/msg-protocol/concept/resource/system-msg';
import { DefnUID, World } from '@warpc/msg-protocol/kinds';
import * as ts from 'typescript';

import { getOrCreateMapType } from './class-traversal';
import { isEnum } from './traversal-utils';
import { TraversalCtx } from './traverser';

export function tryPrimitiveType(t: ts.Type, ctx: TraversalCtx): ClassMsg | undefined {
    const { checker, logger } = ctx;
    const f = t.flags;
    if (f & ts.TypeFlags.String) return SystemMagicContext.getClassMsgByName(World.Client, 'string')!;
    if (f & ts.TypeFlags.Number) return SystemMagicContext.getClassMsgByName(World.Client, 'number')!;
    if (f & ts.TypeFlags.Boolean) return SystemMagicContext.getClassMsgByName(World.Client, 'boolean')!;
    // NOTE: BooleanLiteral NOT handled here - becomes Literal type like StringLiteral and NumberLiteral
    if (f & ts.TypeFlags.Null) return SystemMagicContext.getClassMsgByName(World.Client, 'null')!;
    if (f & ts.TypeFlags.Undefined) return SystemMagicContext.getClassMsgByName(World.Client, 'undefined')!;
    if (f & ts.TypeFlags.Void) return SystemMagicContext.getClassMsgByName(World.Client, 'void')!;
    if (f & ts.TypeFlags.ESSymbol || f & ts.TypeFlags.UniqueESSymbol) {
        logger.debug(`Matched ESSymbol: ${ts.TypeFlags.ESSymbol}, UniqueESSymbol: ${ts.TypeFlags.UniqueESSymbol}`);
        return SystemMagicContext.getClassMsgByName(World.Client, 'symbol')!;
    }
    if (f & ts.TypeFlags.BigInt || f & ts.TypeFlags.BigIntLiteral)
        return SystemMagicContext.getClassMsgByName(World.Client, 'number')!;
    /*
    NOTE: the following produces "Any" class msg which have object's uid... 
    unlike createObjectClassMsg which produces a anon classes (with their own uid) 
    that are instance_of_generic object
    */
    if (f & ts.TypeFlags.NonPrimitive) return SystemMagicContext.getClassMsgByName(World.Client, 'object')!;
    if (f & ts.TypeFlags.Any) return SystemMagicContext.getClassMsgByName(World.Client, 'object')!;

    if (f & ts.TypeFlags.Never) return SystemMagicContext.getClassMsgByName(World.Client, 'void')!;
    if (f & ts.TypeFlags.Unknown) {
        logger.debug(`Found type unknown to TS Compiler: ${checker.typeToString(t)}`);
        return SystemMagicContext.getClassMsgByName(World.Client, 'object')!;
    }
    return undefined;
}

/**
 * Detect direct references to built-in global classes (e.g., String, Number, Boolean, Array, Function, Error, Promise, Map, Set)
 * and return their system ClassMsg. This is an early-path akin to primitives, avoiding creation of new definitions.
 */
export function tryPlainSystemType(t: ts.Type, ctx: TraversalCtx): ClassMsg | undefined {
    const { checker, program, logger } = ctx;
    // Only consider value-level constructor types (e.g., typeof Array, typeof Error, aliases like const X = Array)
    const constructSigs = checker.getSignaturesOfType(t, ts.SignatureKind.Construct);
    if (!constructSigs.length) return undefined;

    const ctor = constructSigs[0];
    let instanceType: ts.Type | undefined;
    try {
        instanceType = checker.getReturnTypeOfSignature(ctor);
    } catch {
        instanceType = undefined;
    }
    const instSym = instanceType?.getSymbol?.();
    const instName = instSym?.getName();
    if (!instName) return undefined;

    // Verify it's from a default library file (not a user-defined type with the same name)
    const declaration = instSym?.declarations?.[0];
    const sourceFile = declaration?.getSourceFile();
    if (!sourceFile || !program.isSourceFileDefaultLibrary(sourceFile)) return undefined;

    const msg = SystemMagicContext.getClassMsgByName(World.Client, instName);
    if (msg) logger.debug(`Matched system constructor by instance type: ${instName}`);
    else logger.debug(`No system type found for default library type: ${instName}`);

    return msg ?? undefined;
}

export function tryGenericSystemType(
    ctx: TraversalCtx,
    t: ts.Type,
    uid: DefnUID,
    typeNode?: ts.TypeNode
): AnnotationMsg | undefined {
    const { checker, traverseTSType, logger } = ctx;
    const f = t.flags;

    // Resolve type aliases to their underlying types
    if ((t as any).aliasSymbol && (t as any).aliasTypeArguments) {
        const resolved = checker.getTypeAtLocation((t as any).aliasSymbol.declarations[0]);
        if (resolved && resolved !== t) {
            return tryGenericSystemType(ctx, resolved, uid);
        }
    }

    // Handle individual literal types
    if (f & ts.TypeFlags.StringLiteral) {
        const value = (t as ts.StringLiteralType).value;
        const literalMsg = SystemMagicContext.createLiteralClassMsg(World.Client, uid, value, 'string');
        logger.debugObject('Built string literal message', literalMsg);
        return literalMsg as any;
    }

    if (f & ts.TypeFlags.NumberLiteral) {
        const value = (t as ts.NumberLiteralType).value;
        const literalMsg = SystemMagicContext.createLiteralClassMsg(World.Client, uid, value, 'number');
        logger.debugObject('Built number literal message', literalMsg);
        return literalMsg as any;
    }

    if (f & ts.TypeFlags.BooleanLiteral) {
        const isTrue = t === checker.getTrueType?.();
        const literalMsg = SystemMagicContext.createLiteralClassMsg(World.Client, uid, isTrue, 'boolean');
        logger.debugObject('Built boolean literal message', literalMsg);
        return literalMsg as any;
    }

    // Enum types
    if (isEnum(t)) {
        const symbol = t.getSymbol();
        const enumDeclaration = symbol?.declarations?.find(ts.isEnumDeclaration);

        if (enumDeclaration) {
            const keys: string[] = [];
            const values: (string | number)[] = [];

            for (const member of enumDeclaration.members) {
                const memberName = member.name.getText();
                const memberValue = checker.getConstantValue(member);

                if (memberValue !== undefined) {
                    keys.push(memberName);
                    values.push(memberValue);
                }
            }

            const enumMsg = SystemMagicContext.createEnumClassMsg(World.Client, uid, keys, values, symbol?.getName());
            logger.debugObject('Built enum message', enumMsg);
            return enumMsg as any;
        }
    }

    // Union<T...>
    // NOTE: boolean type has BOTH Boolean and Union flags - treat as Boolean (caught by tryPrimitiveType), not Union
    if (f & ts.TypeFlags.Union && !(f & ts.TypeFlags.Boolean)) {
        const unionType = t as ts.UnionType;
        const types = reorderCompositeTypesToMatchSource(checker, unionType, typeNode);

        // Detect if union contains both true and false literals (from expanded boolean type)
        // If so, we need to collapse them back to boolean
        const hasTrue = types.some((t) => t.flags & ts.TypeFlags.BooleanLiteral && t === checker.getTrueType?.());
        const hasFalse = types.some((t) => t.flags & ts.TypeFlags.BooleanLiteral && t !== checker.getTrueType?.());

        const classes: ReturnType<typeof ClassMsg.createClassRefMsg>[] = [];

        if (hasTrue && hasFalse) {
            // Replace true and false with boolean primitive
            const booleanPrimitive = SystemMagicContext.getClassRefByName(World.Client, 'boolean')!;
            classes.push(booleanPrimitive);

            // Add all non-boolean-literal types
            const nonBoolLiterals = types.filter((t) => !(t.flags & ts.TypeFlags.BooleanLiteral));
            classes.push(...nonBoolLiterals.map((mt) => ClassMsg.createClassRefMsg(traverseTSType(mt).uid)));
        } else {
            // Normal case: traverse all types
            classes.push(...types.map((mt) => ClassMsg.createClassRefMsg(traverseTSType(mt).uid)));
        }

        // Deduplicate by UID
        const seenUids = new Set<number>();
        const uniqueClasses = classes.filter((c) => {
            if (seenUids.has(c.uid.resource)) {
                return false;
            }
            seenUids.add(c.uid.resource);
            return true;
        });

        const unionMsg = new UnionMsg(uid, { classes: uniqueClasses });
        logger.debugObject('Built union message', unionMsg);
        return unionMsg;
    }

    // Intersection<T...>
    if (f & ts.TypeFlags.Intersection) {
        const interType = t as ts.IntersectionType;
        const types = reorderCompositeTypesToMatchSource(checker, interType, typeNode);
        const classes = types.map((mt) => ClassMsg.createClassRefMsg(traverseTSType(mt).uid));
        const intersectionMsg = new IntersectionMsg(uid, { classes });
        logger.debugObject('Built intersection message', intersectionMsg);
        return intersectionMsg;
    }

    // Array<T>
    if (checker.isArrayType && checker.isArrayType(t)) {
        const typeArgs = (checker as any).getTypeArguments(t);
        const elementT = typeArgs && typeArgs[0] ? typeArgs[0] : undefined;
        const elemUuid = elementT
            ? traverseTSType(elementT).uid
            : SystemMagicContext.getClassRefByName(World.Client, 'Object')!.uid;
        const arrayMsg = SystemMagicContext.createArrayClassMsg(World.Client, uid, elemUuid) as any;
        logger.debugObject('Built array message', arrayMsg);
        return arrayMsg;
    }

    // Tuple types (e.g. [string, number])
    if ((t as any).target && (t as any).target.objectFlags & ts.ObjectFlags.Tuple) {
        const target = (t as any).target;
        const typeArgs = (checker as any).getTypeArguments(t);

        // Tuples with rest/variadic elements (like [string, ...number[]]) → Array<Union>
        if (target.hasRestElement) {
            logger.debug(`Tuple with rest elements detected, treating as Array<Union>: ${checker.typeToString(t)}`);
            const allTypes = (typeArgs || []).flatMap((elemType: ts.Type, i: number) => {
                const flag = target.elementFlags?.[i] || 0;
                if (
                    (flag & ts.ElementFlags.Rest || flag & ts.ElementFlags.Variadic) &&
                    checker.isArrayType?.(elemType)
                ) {
                    const restArgs = (checker as any).getTypeArguments(elemType);
                    return restArgs?.[0] ? [restArgs[0]] : [elemType];
                }
                return [elemType];
            });
            const unionType = allTypes.length > 1 ? (checker as any).getUnionType(allTypes) : allTypes[0];
            const elemUuid = traverseTSType(unionType).uid;
            return SystemMagicContext.createArrayClassMsg(World.Client, uid, elemUuid) as any;
        }

        // Fixed tuple
        logger.debug(`Fixed tuple type detected: ${checker.typeToString(t)}`);
        const elementUuids: DefnUID[] = typeArgs?.map((elemType: ts.Type) => traverseTSType(elemType).uid) || [];
        const tupleMsg = SystemMagicContext.createTupleClassMsg(World.Client, uid, elementUuids) as any;
        logger.debugObject('Built tuple message', tupleMsg);
        return tupleMsg;
    }

    // Type references (Promise/PromiseLike/Set/Map/Record)
    if ((t as any).target || (t as any).aliasSymbol) {
        const typeRef = t as ts.TypeReference;
        const targetSym = typeRef.target?.symbol || (typeRef as any).aliasSymbol;
        const name = targetSym?.escapedName as string | undefined;
        const args: readonly ts.Type[] = (typeRef as any).typeArguments || [];

        // Promise<T> or PromiseLike<T>
        if ((name === 'Promise' || name === 'PromiseLike') && args.length === 1) {
            const valueUuid = traverseTSType(args[0]).uid;
            const futureMsg = SystemMagicContext.createFutureClassMsg(World.Client, uid, valueUuid) as any;
            logger.debugObject('Built future message', futureMsg);
            return futureMsg;
        }

        // Set<T>
        if (name === 'Set' && args.length === 1) {
            const elemUuid = traverseTSType(args[0]).uid;
            const setMsg = SystemMagicContext.createSetClassMsg(World.Client, uid, elemUuid) as any;
            logger.debugObject('Built set message', setMsg);
            return setMsg;
        }

        // Map<K,V>
        if (name === 'Map' && args.length === 2) {
            const keyUuid = traverseTSType(args[0]).uid;
            const valueUuid = traverseTSType(args[1]).uid;
            const mapMsg = SystemMagicContext.createMapClassMsg(World.Client, uid, keyUuid, valueUuid) as any;
            logger.debugObject('Built map message', mapMsg);
            return mapMsg;
        }

        // Record<K,V>
        if (name === 'Record' && args.length === 2) {
            const keyUuid = traverseTSType(args[0]).uid;
            const valueUuid = traverseTSType(args[1]).uid;

            const mapTypeRef = getOrCreateMapType(ctx, keyUuid, valueUuid);

            // Record Record as index signature
            const indexSignature = {
                key_type: ClassMsg.createClassRefMsg(keyUuid),
                value_type: ClassMsg.createClassRefMsg(valueUuid),
                map_type: mapTypeRef,
            };

            const recordMsg = SystemMagicContext.createRecordClassMsg(World.Client, uid, indexSignature) as any;
            logger.debugObject('Built record message', recordMsg);
            return recordMsg;
        }
    }

    return undefined;
}

/**
 * Reorders a normalized composite type's `.types` array (union or intersection)
 * to match the order in the original source, best-effort.
 */
function reorderCompositeTypesToMatchSource(
    checker: ts.TypeChecker,
    type: ts.Type & { types: ts.Type[] },
    typeNode?: ts.TypeNode
): ts.Type[] {
    const isUnion = !!(type.flags & ts.TypeFlags.Union);
    const isIntersection = !!(type.flags & ts.TypeFlags.Intersection);
    if (!isUnion && !isIntersection) return type.types;

    const normalizedTypes = (type as ts.UnionOrIntersectionType).types;

    const nodeFromArg =
        typeNode &&
        ((isUnion && ts.isUnionTypeNode(typeNode)) || (isIntersection && ts.isIntersectionTypeNode(typeNode)))
            ? (typeNode as ts.UnionOrIntersectionTypeNode)
            : undefined;

    let nodeFromDecl: ts.UnionOrIntersectionTypeNode | undefined;
    if (!nodeFromArg) {
        const symbol = (type as any).aliasSymbol ?? (type as any).symbol;
        for (const decl of symbol?.declarations ?? []) {
            if (ts.isTypeAliasDeclaration(decl)) {
                const n = decl.type;
                if ((isUnion && ts.isUnionTypeNode(n)) || (isIntersection && ts.isIntersectionTypeNode(n))) {
                    nodeFromDecl = n as ts.UnionOrIntersectionTypeNode;
                    break;
                }
            }
        }
    }

    const node = nodeFromArg ?? nodeFromDecl;
    if (!node) return moveNullishToEnd(normalizedTypes);

    const sourceOrderedTypes = node.types.map((n) => checker.getTypeFromTypeNode(n));
    const used = new Set<number>();
    const result: ts.Type[] = [];

    // Greedy stable matching: for each source type, take all normalized matches in normalized order
    for (const sourceType of sourceOrderedTypes) {
        for (let i = 0; i < normalizedTypes.length; i++) {
            if (used.has(i)) continue;
            const nt = normalizedTypes[i];
            if (matchesConsideringLiterals(checker, sourceType, nt)) {
                result.push(nt);
                used.add(i);
            }
        }
    }

    // Append any unmatched normalized types
    for (let i = 0; i < normalizedTypes.length; i++) if (!used.has(i)) result.push(normalizedTypes[i]);

    return moveNullishToEnd(result);
}

const areTypesEffectivelyIdentical = (checker: ts.TypeChecker, a: ts.Type, b: ts.Type): boolean =>
    checker.isTypeAssignableTo(a, b) && checker.isTypeAssignableTo(b, a);

const isBooleanType = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.Boolean);
const isBooleanLiteral = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.BooleanLiteral);
const isNumberType = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.Number);
const isNumberLiteral = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.NumberLiteral);
const isStringType = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.String);
const isStringLiteral = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.StringLiteral);
const isBigIntType = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.BigInt);
const isBigIntLiteral = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.BigIntLiteral);

function matchesConsideringLiterals(checker: ts.TypeChecker, source: ts.Type, normalized: ts.Type): boolean {
    if (areTypesEffectivelyIdentical(checker, source, normalized)) return true;

    // Primitive container on source side (e.g., boolean) matching literal union members (true|false)
    if (isBooleanType(source) && isBooleanLiteral(normalized)) return true;
    if (isNumberType(source) && isNumberLiteral(normalized)) return true;
    if (isStringType(source) && isStringLiteral(normalized)) return true;
    if (isBigIntType(source) && isBigIntLiteral(normalized)) return true;

    // Literal on source side matching primitive container on normalized side (rare, but be safe)
    if (isBooleanLiteral(source) && isBooleanType(normalized)) return true;
    if (isNumberLiteral(source) && isNumberType(normalized)) return true;
    if (isStringLiteral(source) && isStringType(normalized)) return true;
    if (isBigIntLiteral(source) && isBigIntType(normalized)) return true;

    return false;
}

const isUndefinedType = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.Undefined);
const isNullType = (t: ts.Type): boolean => !!(t.flags & ts.TypeFlags.Null);
const isNullishType = (t: ts.Type): boolean => isUndefinedType(t) || isNullType(t);

function moveNullishToEnd(types: readonly ts.Type[]): ts.Type[] {
    const head: ts.Type[] = [];
    const tail: ts.Type[] = [];
    for (const t of types) (isNullishType(t) ? tail : head).push(t);
    return [...head, ...tail];
}
