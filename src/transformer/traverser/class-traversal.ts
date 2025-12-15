import { extractDocstringFromSymbol } from '@transformer/processor/processor-utils';
import { InterfaceMsg } from '@warpc/msg-protocol/concept/annotations/annotation-msg';
import { RefMsg } from '@warpc/msg-protocol/concept/concept';
import {
    ClassField,
    ClassMethod,
    ClassMsg,
    ClassPayload,
    TypeArgument,
} from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionArgument, FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ANONYMOUS_CLASS } from '@warpc/msg-protocol/concept/resource/resource-msg';
import { CLASS_IDS, SystemContext } from '@warpc/msg-protocol/concept/resource/system-msg';
import { ConceptKind, DefnUID, World } from '@warpc/msg-protocol/kinds';
import * as ts from 'typescript';

import {
    TypeSubstitutionMap,
    hasConstructor,
    isBuiltinConcept,
    isEnum,
    parseParameterArgument,
} from './traversal-utils';
import { TraversalCtx, TraversalRecord } from './traverser';

export function getOrCreateMapType(ctx: TraversalCtx, keyUid: DefnUID, valueUid: DefnUID): RefMsg<ClassMsg> {
    const { records, logger, allocateUid } = ctx;

    /*
    Check if we already have a Map with these exact type arguments

    Comment: we do this currently by searching messages (not types), and adding messages as needed.
    This circumvents setting the recordsByType of the traverser, which could lead to a duplicate record
    for the intended map type (but that is okay, since we do not materialize Map Types as classes)
    */
    for (const [uid, record] of records.entries()) {
        if (record.msg.kind === ConceptKind.Resource.Cls) {
            const clsMsg = record.msg as ClassMsg;
            const payload = clsMsg.payload;

            if (
                payload.instance_of_generic?.resource === CLASS_IDS.Map &&
                payload.supplied_type_args &&
                (payload.supplied_type_args as TypeArgument[]).length === 2
            ) {
                const [keyArg, valueArg] = payload.supplied_type_args as TypeArgument[];
                if (
                    keyArg.type.uid.world === keyUid.world &&
                    keyArg.type.uid.resource === keyUid.resource &&
                    valueArg.type.uid.world === valueUid.world &&
                    valueArg.type.uid.resource === valueUid.resource
                ) {
                    logger.debug(
                        `Reusing existing Map<${keyUid.resource}, ${valueUid.resource}> with UID ${uid.resource}`
                    );
                    return ClassMsg.createClassRefMsg(uid);
                }
            }
        }
    }

    // No existing Map<K,V> found, create a new one
    const mapUid = allocateUid();
    const mapMsg = SystemContext.createMapClassMsg(World.Client, mapUid, keyUid, valueUid);

    const mapRecord: TraversalRecord = {
        uid: mapUid,
        msg: mapMsg,
    };
    records.set(mapUid, mapRecord);

    logger.debug(`Created new Map<${keyUid.resource}, ${valueUid.resource}> with UID ${mapUid.resource}`);

    return ClassMsg.createClassRefMsg(mapUid);
}

export function traverseThroughClass(
    name: string | undefined,
    ctx: TraversalCtx,
    t: ts.Type,
    uid: DefnUID
): ClassMsg | InterfaceMsg {
    const { checker, traverseTSType, records, logger } = ctx;

    // Check for type alias first, then fall back to the underlying type's symbol
    const aliasSym = (t as any).aliasSymbol as ts.Symbol | undefined;
    const sym = aliasSym || t.getSymbol();
    let className = name ?? (sym && sym.getName()) ?? ANONYMOUS_CLASS;

    // Special case: treat globalThis as a plain object to avoid deep traversal
    if (className === 'globalThis') {
        logger.debug('Stopping at globalThis, returning object');
        return SystemContext.getClassMsgByName(World.Client, 'object')!;
    }

    const isInterface = !hasConstructor(t);

    // Replace __type and __object (TypeScript's names for anonymous inline object types) with a proper anonymous name
    if (className === '__type' || className === '__object') {
        logger.debug(
            `Replacing ${className} with ${ANONYMOUS_CLASS} for ${isInterface ? 'interface' : 'class'} ${uid.resource}`
        );
        className = ANONYMOUS_CLASS + '_' + uid.resource.toString();
    }
    const doc = sym ? extractDocstringFromSymbol(sym) : undefined;

    const fields: ClassField[] = [];
    const methods: ClassMethod[] = [];

    // Resolve the class declaration and constructor type early
    let classDecl: ts.Declaration | undefined;
    let constructorFunctionType: ts.Type | undefined;
    if (sym && (sym.valueDeclaration || (sym.declarations && sym.declarations[0]))) {
        classDecl = (sym.valueDeclaration || sym.declarations![0]) as ts.Declaration;
        constructorFunctionType = checker.getTypeOfSymbolAtLocation(sym, classDecl);
    }

    /*
    ** Generic classes logic (e.g. Factory<T, U> -> Factory<string, number>) **

    Terminology:
    * typeParams: The generic parameters declared on the class itself, e.g. in class Box<T, U> {}, the T and U. read
        these from the declaration via clsDecl.typeParameters.
    * typeArgs: The concrete types supplied at the use site, e.g.Map<string, number>. read these from the ts.
        TypeReference((t as ts.TypeReference).typeArguments).
    */
    // Build type substitution map from generic class type parameters to concrete type arguments
    let typeSubstitutionMap: TypeSubstitutionMap | undefined;
    let supplied_type_args: TypeArgument[] | undefined;
    const maybeTypeRef = t as ts.TypeReference;
    const typeArgs: readonly ts.Type[] | undefined = (maybeTypeRef as any).typeArguments;
    if (typeArgs && typeArgs.length && classDecl && ts.isClassLike(classDecl as any)) {
        const clsDecl = classDecl as ts.ClassLikeDeclaration;
        const typeParams = clsDecl.typeParameters || ts.factory.createNodeArray();

        if (typeParams.length === typeArgs.length) {
            typeSubstitutionMap = {};
            for (let i = 0; i < typeParams.length; i++) {
                const paramName = typeParams[i].name.text;
                typeSubstitutionMap[paramName] = ClassMsg.createClassRefMsg(traverseTSType(typeArgs[i], true).uid);
            }
            supplied_type_args = Object.entries(typeSubstitutionMap).map(([name, type]) => ({ name, type }));
        } else {
            throw new Error(
                `Type ${className} has ${typeParams.length} type parameters but ${typeArgs.length} type arguments. ` +
                    `This is currently not supported during type analysis.`
            );
        }
    }

    function addClassMember(memberName: string, memberType: ts.Type, isStatic: boolean, memberSymbol?: ts.Symbol) {
        // Attempt to capture the source TypeNode for better ordering of unions/intersections
        const memberDecl = (memberSymbol?.valueDeclaration || memberSymbol?.declarations?.[0]) as
            | ts.Declaration
            | undefined;
        let memberTypeNode: ts.TypeNode | undefined = undefined;
        if (memberDecl && (ts.isPropertySignature(memberDecl) || ts.isPropertyDeclaration(memberDecl))) {
            memberTypeNode = (memberDecl as ts.PropertySignature | ts.PropertyDeclaration).type;
        }
        const callSigs = checker.getSignaturesOfType(memberType, ts.SignatureKind.Call);
        if (callSigs.length > 0) {
            // methods
            logger.debug(`METHOD: detected that ${memberName} is a method of ${uid.resource}`);

            // Yields either an existing method record or a new Function Type class message
            const memberTypeRecord = traverseTSType(memberType, false, memberTypeNode, typeSubstitutionMap);

            // Class message case
            if (memberTypeRecord.msg.kind === ConceptKind.Resource.Cls) {
                logger.debugObject(`Method ${memberName} resolved to`, memberTypeRecord.msg);
                const funcMsg = (memberTypeRecord.msg as ClassMsg).payload.supplied_type_args as FunctionMsg;
                if (funcMsg === undefined) {
                    // throw unsupportedBultinClass(className, 'code');
                    return;
                }
                memberTypeRecord.msg = funcMsg; // replace ClassMsg with FunctionMsg in place!

                const methodUuid = memberTypeRecord.uid;

                let isPrivate = false;
                if (memberSymbol) {
                    const decl = memberSymbol.valueDeclaration || memberSymbol.declarations?.[0];
                    if (decl && ts.isMethodDeclaration(decl)) {
                        isPrivate =
                            memberName.startsWith('#') ||
                            (decl.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword) ?? false);
                    }
                }

                methods.push({
                    name: memberName,
                    function: FunctionMsg.createFunctionRefMsg(funcMsg.uid),
                    is_static: isStatic,
                    is_private: isPrivate,
                });
                const methodRecord = records.get(methodUuid);
                if (methodRecord) {
                    // Set accessor path only for runtime classes (not interfaces)
                    if (!isInterface) {
                        methodRecord.__accessorPath = isStatic
                            ? [className, memberName]
                            : [className, 'prototype', memberName];
                    }

                    // Convert to MethodSignatureMsg for all methods (classes and interfaces)
                    if (methodRecord.msg.kind === 'func') {
                        if (typeof (methodRecord.msg as any).toMethodSignature === 'function') {
                            methodRecord.msg.payload.name = memberName;
                            methodRecord.msg = (methodRecord.msg as FunctionMsg).toMethodSignature({
                                uid,
                                kind: isStatic ? 'static' : 'instance',
                            });
                            logger.debug(`Method ${memberName} converted to MethodSignatureMsg`);
                        } else {
                            logger.warn(
                                `Method ${memberName} was interpreted by the type traverser as a non-function with the following message:`,
                                methodRecord.msg
                            );
                            logger.debugObject(`Method ${memberName} resolved to`, methodRecord.msg);
                        }
                    }
                }
            }
        } else {
            // fields
            logger.debug(`FIELD: detected that ${memberName} is a field of ${uid.resource}`);
            const fieldUid = traverseTSType(memberType, true, memberTypeNode, typeSubstitutionMap).uid;

            let isOptional = false;
            let isPrivate = false;
            if (memberSymbol) {
                const decl = memberSymbol.valueDeclaration || memberSymbol.declarations?.[0];
                if (decl && (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl))) {
                    isOptional = decl.questionToken !== undefined;
                    isPrivate =
                        memberName.startsWith('#') ||
                        (decl.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword) ?? false);
                }
            }

            fields.push({
                name: memberName,
                type: ClassMsg.createClassRefMsg(fieldUid),
                is_static: isStatic,
                is_optional: isOptional,
                is_private: isPrivate,
            });

            if (isStatic && !isInterface) {
                const maybeMsg = records.get(fieldUid);
                if (maybeMsg && maybeMsg.msg.kind === 'obj') {
                    maybeMsg.__accessorPath = [className, memberName];
                }
            }
        }
    }

    // Instance members
    // Skip instance members for enums - they duplicate the static members
    if (!isEnum(t)) {
        for (const prop of checker.getPropertiesOfType(t)) {
            const propName = prop.getName();

            // Skip TypeScript internals and global augmentations
            if (isBuiltinConcept(propName)) {
                logger.debug(`Skipping internal/global member: ${propName}`);
                continue;
            }

            logger.debug(`Adding instance member ${propName}`);
            const propDecl = prop.valueDeclaration || (prop.declarations && prop.declarations[0]);
            if (!propDecl) continue;
            const propType = checker.getTypeOfSymbolAtLocation(prop, propDecl);
            addClassMember(propName, propType, false, prop);
        }
    }

    // Static (class) members
    if (classDecl && constructorFunctionType) {
        for (const sprop of checker.getPropertiesOfType(constructorFunctionType)) {
            const sname = sprop.getName();
            if (sname === 'prototype' || sname === 'length' || sname === 'name') continue;
            const sdecl = (sprop.valueDeclaration || (sprop.declarations && sprop.declarations[0])) as
                | ts.Declaration
                | undefined;
            if (!sdecl) continue;
            const stype = checker.getTypeOfSymbolAtLocation(sprop, sdecl);
            addClassMember(sname, stype, true, sprop);
        }
    }

    // Base classes and implemented interfaces
    let bases: RefMsg<ClassMsg>[] | undefined = undefined;
    const allBases: ts.Type[] = [];

    // Get extended base classes
    const baseTypes = t.getBaseTypes && t.getBaseTypes();
    if (baseTypes) {
        allBases.push(...baseTypes);
    }

    // Get implemented interfaces from heritage clauses
    if (classDecl && ts.isClassDeclaration(classDecl) && classDecl.heritageClauses) {
        for (const heritageClause of classDecl.heritageClauses) {
            if (heritageClause.token === ts.SyntaxKind.ImplementsKeyword) {
                for (const typeExpr of heritageClause.types) {
                    const interfaceType = checker.getTypeAtLocation(typeExpr);
                    // Only add if not already in baseTypes (avoid duplicates)
                    if (!baseTypes?.some((bt) => bt === interfaceType)) {
                        allBases.push(interfaceType);
                    }
                }
            }
        }
    }

    if (allBases.length > 0) {
        bases = allBases.map((baseType: ts.Type) => {
            const baseSym = baseType.getSymbol?.();
            const baseName = baseSym?.getName();
            logger.debug(`BASE CLASS: detected that ${baseName} is a base class of ${uid.resource}`);
            // Use compiler signals: instance-side built-ins (e.g., Error) have no constructor declarations
            if (baseName && !hasConstructor(baseType) && SystemContext.isSystemResourceName(baseName)) {
                const sysRef = SystemContext.getClassRefByName(World.Client, baseName);
                if (sysRef) return sysRef;
            }
            const baseUuid = traverseTSType(baseType, false).uid;
            return ClassMsg.createClassRefMsg(baseUuid);
        });
    }

    // Build constructor parameter mapping
    let ctor_args: FunctionArgument[] | undefined;

    if (constructorFunctionType) {
        const constructSigs = checker.getSignaturesOfType(constructorFunctionType, ts.SignatureKind.Construct);
        const ctorSig = constructSigs && constructSigs[0];
        if (ctorSig) {
            const argMap: FunctionArgument[] = [];
            for (const param of ctorSig.getParameters()) {
                const decl = (param.valueDeclaration || param.declarations?.[0]) as ts.Declaration | undefined;
                if (!decl) continue;
                const paramType = checker.getTypeOfSymbolAtLocation(param, decl);
                argMap.push(parseParameterArgument(param, checker, traverseTSType, paramType, typeSubstitutionMap));
            }
            if (Object.keys(argMap).length > 0) ctor_args = argMap;
        }
    }

    // Check for index signatures and record metadata
    // (works for both interfaces and classes)
    const obj: any = t as any;
    const infos: readonly ts.IndexInfo[] | undefined = obj.indexInfos;

    let indexSignature:
        | { key_type: RefMsg<ClassMsg>; value_type: RefMsg<ClassMsg>; map_type: RefMsg<ClassMsg> }
        | undefined;
    if (infos && infos.length > 0) {
        if (infos.length > 1) {
            throw new Error(
                `Type ${className} has multiple index signatures (e.g., both [key: string] and [index: number]). ` +
                    `This is currently not supported during type analysis.`
            );
        }

        const indexInfo = infos[0];
        const keyTypeUid = traverseTSType(indexInfo.keyType, true, undefined, typeSubstitutionMap).uid;
        const valueTypeUid = traverseTSType(indexInfo.type, true, undefined, typeSubstitutionMap).uid;

        logger.debug(
            `${isInterface ? 'Interface' : 'Class'} has index signature [${indexInfo.keyType.flags}]: ${indexInfo.type.flags} - recording metadata`
        );

        // Create or reuse Map<K,V> type for this index signature
        const mapTypeRef = getOrCreateMapType(ctx, keyTypeUid, valueTypeUid);

        // Record index signature metadata
        indexSignature = {
            key_type: ClassMsg.createClassRefMsg(keyTypeUid),
            value_type: ClassMsg.createClassRefMsg(valueTypeUid),
            map_type: mapTypeRef,
        };
    }

    // Construct final message
    if (isInterface) {
        const meta: ClassPayload = {
            name: className,
            fields: fields.length ? fields : [],
            methods: methods.length ? methods : [],
            module: t.getSymbol()?.declarations?.[0]?.getSourceFile()?.fileName as string,
            bases: undefined, // NOTE: interfaces don't inherit
            doc: doc || undefined,
            index_signature: indexSignature,
        } as ClassPayload;
        return ClassMsg.createInterfaceMsg(uid, meta);
    } else {
        const payload: ClassPayload = {
            name: className,
            fields: fields.length ? fields : [],
            methods: methods.length ? methods : [],
            module: t.getSymbol()?.declarations?.[0]?.getSourceFile()?.fileName as string,
            bases,
            supplied_type_args,
            ctor_args,
            doc: doc || undefined,
            system_resource: false,
            index_signature: indexSignature,
        };
        const msg = new ClassMsg(uid, payload);
        return msg;
    }
}
