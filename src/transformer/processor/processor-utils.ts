import type { ClassTarget } from './class-targets';
import type { FunctionTarget } from './function-targets';
import type { ObjectTarget } from './object-targets';
import type { ScopedLogger } from '@logging/index';

import * as fs from 'fs';
import * as path from 'path';

import { type RuntimeMappings, getRuntimeMappings } from '@transformer/transformer-config';
import { isAgentCallMethodReference, isMagicLibraryFunction } from '@transformer/transformer-utils';
import { SchemaTraversal } from '@transformer/traverser/traverser';
import { DefMsg } from '@warpc/msg-protocol/concept/concept';
import { ANONYMOUS_CLASS } from '@warpc/msg-protocol/concept/resource/resource-msg';
import { ConceptKind, DefnUID } from '@warpc/msg-protocol/kinds';
import * as ts from 'typescript';

export type ProcessedRecord = {
    uid: DefnUID;
    defMsg: DefMsg;
    defName: string;
    importModule?: string; // e.g. @slack/web-api, axios, etc.
    accessorPath?: string[]; // e.g. foo.bar.baz → ['foo', 'bar', 'baz']
    magicArgumentPath?: string[]; // Accessor path for symbols explicitly passed to magic(), e.g. magic({ foo.bar })
    magicArgumentExpr?: ts.Expression; // Original explicit expression, preferred for codegen
    systemInternalType?: boolean; // Runtime kind but no module/magic path (e.g., stdlib)
    declarationOnly?: boolean; // From @types/* - type info only, no runtime access
};

export type CompiledProcessedRecord = {
    defName: string;
    defMsg: string;
    defGetter?: any;
    systemInternalType?: boolean;
};

export type ConceptContext = Map<DefnUID, ProcessedRecord>;
export type CompiledConceptContext = Record<string, CompiledProcessedRecord>;

export const ANON_DEF_PREFIX = '___anonymous__';

export function resolveUidAlias(uid: number, aliases: Map<number, number>, logger?: ScopedLogger): number {
    let current = uid;
    const visited = new Set<number>();

    // Follow alias chain transitively
    while (aliases.has(current)) {
        if (visited.has(current)) {
            logger?.error(`[${logger?.getAttribute('location')}] Circular alias detected for uid ${uid}`);
            break;
        }
        visited.add(current);
        current = aliases.get(current)!;
    }

    return current;
}

export function replaceAliasedUids(msgPart: any, aliases: Map<number, number>, logger?: ScopedLogger): void {
    if (!msgPart || typeof msgPart !== 'object') return;

    // Replace UID references
    if (msgPart.uid && typeof msgPart.uid.resource === 'number') {
        const aliased = resolveUidAlias(msgPart.uid.resource, aliases, logger);
        if (aliased !== msgPart.uid.resource) {
            msgPart.uid.resource = aliased;
        }
    }

    // Recurse into nested structures
    for (const key in msgPart) {
        if (msgPart[key] && typeof msgPart[key] === 'object') {
            if (Array.isArray(msgPart[key])) {
                msgPart[key].forEach((item: any) => replaceAliasedUids(item, aliases, logger));
            } else {
                replaceAliasedUids(msgPart[key], aliases, logger);
            }
        }
    }
}

function extractTypesPackageName(modulePath: string): string | null {
    const match = modulePath.match(/@types\/([^/]+)/);
    return match ? match[1] : null;
}

function mapTypesPackageToRuntime(
    modulePath: string,
    runtimeMappings: RuntimeMappings,
    _program: ts.Program
): string | null {
    const typesPackage = extractTypesPackageName(modulePath);
    if (!typesPackage) return null;

    if (runtimeMappings[typesPackage]) {
        return modulePath.replace(/@types\/[^/]+/, runtimeMappings[typesPackage]);
    }

    // Heuristic: Check if runtime file exists with common extensions
    // Order matters - check most common first for performance
    const extensionsToTry = [
        '.js', // Default
        '.mjs', // ESM
        '.cjs', // CJS
        '.jsx', // React
    ];

    const baseRuntimePath = modulePath.replace(/@types\/([^/]+)/, '$1').replace(/\.d\.ts$/, '');

    for (const ext of extensionsToTry) {
        const candidatePath = baseRuntimePath + ext;
        if (fs.existsSync(candidatePath)) {
            // Return the module specifier with the package name replacement
            // Keep the original subpath structure, just replace @types/package
            return modulePath.replace(/@types\/[^/]+/, typesPackage).replace(/\.d\.ts$/, ext);
        }
    }

    return null;
}

export function upsertContextFromTraversalRecords(
    traversal: SchemaTraversal,
    context: ConceptContext,
    program: ts.Program,
    logger?: ScopedLogger
): void {
    const runtimeMappings = getRuntimeMappings(program);
    for (const [uid, record] of traversal.recordsByUid) {
        if (context.has(uid)) continue;

        const msg: DefMsg = record.msg;
        const kind: ConceptKind.Any = msg?.kind as ConceptKind.Any;
        const payload: any = msg?.payload;
        const modulePath: string | undefined = payload?.module || record.__module;
        const accessorPath: string[] | undefined = record.__accessorPath;
        let defName: string;

        switch (kind) {
            case ConceptKind.Resource.Cls:
            case ConceptKind.Resource.Func:
            case ConceptKind.Resource.Obj:
                defName = payload.name;
                if (!defName || defName === ANONYMOUS_CLASS) {
                    if (defName === undefined) {
                        logger?.warn(`[${logger?.getAttribute('location')}] no name for definition record:`, record);
                    }
                    defName = 'Resource' + uidSuffix(uid);
                    payload.name = defName;
                }
                break;
            case ConceptKind.Annotation.MemberSig:
                // Mark method signatures with # prefix to indicate they should not
                // be added to Python locals (they're already part of their class)
                defName = '#' + payload.name + '_method_' + uidSuffix(uid);
                break;
            case ConceptKind.Annotation.Interface:
                defName = payload.name;
                if (!defName || defName === ANONYMOUS_CLASS) {
                    if (!defName) {
                        logger?.warn(`[${logger?.getAttribute('location')}] no name for annotation:`, record);
                    }
                    defName = 'Interface' + uidSuffix(uid);
                    payload.name = defName;
                }
                break;
            case ConceptKind.Annotation.Union:
                defName = 'Union' + uidSuffix(uid);
                payload.name = defName;
                break;
            case ConceptKind.Annotation.Intersection:
                {
                    const intersected = (payload as any).classes || [];
                    const names = intersected.map((ref: any) => {
                        const baseRec = context.get(ref.uid);
                        return baseRec?.defName || `Unknown${uidSuffix(ref.uid)}`;
                    });
                    defName = names.length > 0 ? names.join('And') : 'Intersection_' + uidSuffix(uid);
                    payload.name = defName;
                }
                break;
            default:
                defName = 'builtin' + uidSuffix(uid);
                payload.name = defName;
                break;
        }

        const isRuntimeKind =
            kind === ConceptKind.Resource.Cls ||
            kind === ConceptKind.Resource.Func ||
            kind === ConceptKind.Resource.Obj;

        // Detect system internal types: stdlib methods with no module path
        // Only flag as system internal if it's a runtime kind with accessor path but no module
        // (e.g., Function.prototype.apply) - excludes interface methods which have no accessor path
        const systemInternalType =
            isRuntimeKind && !modulePath && !record.__magicArgumentPath && !!accessorPath?.length; // Has computed path (e.g., ["Function", "prototype", "apply"])

        // Detect @types/* packages and map to runtime if possible
        const isTypesPackage = modulePath?.includes('/@types/');
        let computedModulePath = modulePath;
        let declarationOnly = false;

        if (isRuntimeKind && isTypesPackage && modulePath) {
            const runtimePath = mapTypesPackageToRuntime(modulePath, runtimeMappings, program);
            logger?.debug(`@@ Runtime path for @types package: actual ${modulePath} computed ${runtimePath ?? 'none'}`);
            if (runtimePath) {
                computedModulePath = runtimePath;
            } else {
                declarationOnly = true;
            }
        }

        if (payload && typeof payload === 'object') {
            payload.is_top_level = record.__isTopLevel || false;
            if (!payload.module && computedModulePath) {
                logger?.debug(`Setting module for ${defName}: ${computedModulePath}`);
                payload.module = computedModulePath;
            }
        }

        const rec: ProcessedRecord = {
            uid,
            defMsg: record.msg,
            defName,
            importModule: computedModulePath,
            accessorPath: accessorPath,
            magicArgumentPath: record.__magicArgumentPath,
            magicArgumentExpr: (record as any).__magicArgumentExpr,
            systemInternalType: systemInternalType || undefined,
            declarationOnly: declarationOnly || undefined,
        };
        context.set(uid, rec);
    }
}

const uidSuffix = (uid: DefnUID): string => {
    return uid.resource.toString().replaceAll('-', '_');
};

export function resolveDeclaration(
    checker: ts.TypeChecker,
    id: ts.Identifier,
    logger?: ScopedLogger
): ts.Declaration | undefined {
    let symbol = checker.getSymbolAtLocation(id);
    if (!symbol) {
        logger?.debug(`resolving ${id.text}: no symbol`);
        return undefined;
    }
    const wasAlias = !!(symbol.flags & ts.SymbolFlags.Alias);
    if (wasAlias) {
        try {
            symbol = checker.getAliasedSymbol(symbol);
        } catch {
            // Ignore aliasing errors
        }
    }
    const decl = symbol.valueDeclaration || (symbol.declarations && symbol.declarations[0]) || undefined;
    logger?.debug(
        `resolved declaration for ${id.text}: symbol=${symbol.getName?.()} alias=${wasAlias} resolved=${
            decl ? ts.SyntaxKind[decl.kind] : 'none'
        }`
    );
    return decl;
}

export function extractAccessorPath(expr: ts.Expression): string[] {
    const path: string[] = [];
    let current: ts.Expression = expr;

    while (true) {
        if (ts.isIdentifier(current)) {
            path.unshift(current.text);
            break;
        } else if (ts.isPropertyAccessExpression(current)) {
            path.unshift(current.name.text);
            current = current.expression;
        } else if (ts.isElementAccessExpression(current)) {
            if (ts.isStringLiteral(current.argumentExpression)) {
                path.unshift(current.argumentExpression.text);
                current = current.expression;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    return path.length > 0 ? path : [expr.getText()];
}

function _getBaseIdentifier(expr: ts.Expression): ts.Identifier | undefined {
    let current = expr;
    while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
        current = current.expression;
    }
    return ts.isIdentifier(current) ? current : undefined;
}

function validateScopeExpression(expr: ts.Expression, checker: ts.TypeChecker, call: ts.CallExpression): void {
    if (isMagicLibraryFunction(expr, call.getSourceFile())) {
        const sourceFile = call.getSourceFile();
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(expr.getStart()).line + 1;
        throw new Error(
            `Cannot pass 'spawn', 'magic', or 'magicPro' functions as scope arguments at ${sourceFile.fileName}:${lineNumber}. ` +
                `These functions must be transformed before they can be used and cannot be passed into agent scope.`
        );
    }

    if (isAgentCallMethodReference(expr, checker)) {
        const sourceFile = call.getSourceFile();
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(expr.getStart()).line + 1;
        throw new Error(
            `Cannot pass 'agent.call' or 'agent.callPro' methods as scope arguments at ${sourceFile.fileName}:${lineNumber}. ` +
                `These methods must be invoked directly and cannot be passed into agent scope.`
        );
    }
}

function classifyAndCollectTarget(
    expr: ts.Expression,
    name: string,
    accessorPath: string[],
    checker: ts.TypeChecker,
    call: ts.CallExpression,
    targets: { functionTargets: FunctionTarget[]; objectTargets: ObjectTarget[]; classTargets: ClassTarget[] },
    logger?: ScopedLogger
): void {
    const exprType = checker.getTypeAtLocation(expr);
    const hasConstruct = exprType.getConstructSignatures && exprType.getConstructSignatures().length > 0;
    const hasCall = exprType.getCallSignatures && exprType.getCallSignatures().length > 0;

    if (hasConstruct) {
        logger?.debug(`target class ${name} (accessor: ${accessorPath.join('.')})`);
        targets.classTargets.push({
            scanExpression: call,
            name,
            accessorPath,
            classNode: expr,
            sourceFile: call.getSourceFile(),
        });
    } else if (hasCall) {
        logger?.debug(`target func ${name} (accessor: ${accessorPath.join('.')})`);
        targets.functionTargets.push({
            scanExpression: call,
            name,
            accessorPath,
            node: expr,
            sourceFile: call.getSourceFile(),
        });
    } else {
        logger?.debug(`target obj ${name} (accessor: ${accessorPath.join('.')})`);
        targets.objectTargets.push({
            scanExpression: call,
            name,
            accessorPath,
            node: expr,
            sourceFile: call.getSourceFile(),
        });
    }
}

export function collectTargetsFromObjectLiteral(
    checker: ts.TypeChecker,
    call: ts.CallExpression,
    obj: ts.ObjectLiteralExpression,
    logger?: ScopedLogger
): {
    functionTargets: FunctionTarget[];
    objectTargets: ObjectTarget[];
    classTargets: ClassTarget[];
} {
    const functionTargets: FunctionTarget[] = [];
    const objectTargets: ObjectTarget[] = [];
    const classTargets: ClassTarget[] = [];

    for (const prop of obj.properties) {
        if (!ts.isShorthandPropertyAssignment(prop) && !ts.isPropertyAssignment(prop)) continue;

        const nameText = ts.isIdentifier(prop.name) ? prop.name.text : prop.name.getText();
        const rhsExpr: ts.Expression = ts.isShorthandPropertyAssignment(prop)
            ? prop.name
            : (prop as ts.PropertyAssignment).initializer;
        const accessorPath = extractAccessorPath(rhsExpr);

        validateScopeExpression(rhsExpr, checker, call);
        classifyAndCollectTarget(
            rhsExpr,
            nameText,
            accessorPath,
            checker,
            call,
            { functionTargets, objectTargets, classTargets },
            logger
        );
    }

    return { functionTargets, objectTargets, classTargets };
}

export function getSpecifiedGenericTypeArg(
    checker: ts.TypeChecker,
    call: ts.CallExpression,
    logger?: ScopedLogger
): ts.Type | undefined {
    let typeArgs = call.typeArguments;

    // For Pro calls: agent.callPro<T>`text`() or agenticPro<T>`text`()
    // The type argument might be on the TaggedTemplateExpression or its tag
    if ((!typeArgs || typeArgs.length === 0) && ts.isTaggedTemplateExpression(call.expression)) {
        logger?.debug('No type arguments found on call, trying TaggedTemplateExpression and tag');

        // First try the TaggedTemplateExpression itself
        typeArgs = (call.expression as any).typeArguments;
        if (typeArgs && typeArgs.length > 0) {
            logger?.debug(`Found ${typeArgs.length} type arguments on TaggedTemplateExpression`);
        } else {
            // If not there, try the tag
            const tag = call.expression.tag;
            typeArgs = (tag as any).typeArguments;
            if (typeArgs && typeArgs.length > 0) {
                logger?.debug(`Found ${typeArgs.length} type arguments on tag`);
            }
        }
    }

    if (!typeArgs || typeArgs.length === 0) {
        logger?.debug('No type arguments found - returning undefined');
        return undefined;
    }
    logger?.debug(`Using type argument at index 0, typeNode kind: ${ts.SyntaxKind[typeArgs[0].kind]}`);

    const typeNode = typeArgs[0];
    try {
        logger?.debug(`Attempting to get type from typeNode`);
        const t = checker.getTypeFromTypeNode(typeNode);
        const f: number = (t as any).flags ?? 0;
        const TypeFlagsAny = (ts as any).TypeFlags?.Any ?? 1;
        const TypeFlagsUnknown = (ts as any).TypeFlags?.Unknown ?? 2;
        if (f & TypeFlagsAny || f & TypeFlagsUnknown) {
            throw new Error('Specified generic type cannot be any/unknown');
        }
        return t;
    } catch (e) {
        logger?.error(`[${logger?.getAttribute('location')}] Error resolving type: ${(e as Error).message}`);
        throw new Error(`failed to resolve specified generic type: ${(e as Error).message}`);
    }
}

export function assertTypeNarrowerThan(checker: ts.TypeChecker, specified: ts.Type, baseType: ts.Type): void {
    // specified should be assignable to (subtype of) baseType
    if (!checker.isTypeAssignableTo(specified, baseType)) {
        const s = checker.typeToString(specified);
        const b = checker.typeToString(baseType);
        throw new Error(`specified generic type ${s} is not a subtype of call type ${b}`);
    }
}

export function resolveTraverseType(
    checker: ts.TypeChecker,
    call: ts.CallExpression,
    logger?: ScopedLogger,
    siteId?: number
): ts.Type {
    const ctxType: ts.Type | undefined = checker.getContextualType(call);

    const unwrapPromiseLike = (t: ts.Type | undefined): ts.Type | undefined => {
        if (!t) return undefined;

        // Special case: handle T | Promise<T> -> T
        if ((t.flags & ts.TypeFlags.Union) !== 0) {
            const unionType = t as ts.UnionType;
            if (unionType.types.length === 2) {
                const [type1, type2] = unionType.types;

                // do we have maybePromise is Promise<nonPromise>?
                const checkPromiseUnion = (nonPromise: ts.Type, maybePromise: ts.Type): ts.Type | undefined => {
                    const typeRef = maybePromise as ts.TypeReference;
                    const targetSym = typeRef.target?.symbol || typeRef.aliasSymbol;
                    const name: string | undefined = targetSym?.escapedName as any;
                    const args = typeRef.typeArguments || [];

                    if (name === 'PromiseLike' && args.length === 1) {
                        const promiseInner = args[0];
                        if (checker.typeToString(promiseInner) === checker.typeToString(nonPromise)) {
                            return nonPromise;
                        }
                    }
                    return undefined;
                };

                // up to symmetry
                const result = checkPromiseUnion(type1, type2) || checkPromiseUnion(type2, type1);
                if (result) return result;
            }

            // old logic
            return t;
        }

        // Single type: unwrap if it's a PromiseLike
        const typeRef = t as ts.TypeReference;
        const targetSym = (typeRef as any).target?.symbol || (typeRef as any).aliasSymbol;
        const name: string | undefined = targetSym?.escapedName as any;
        const args: readonly ts.Type[] = (typeRef as any).typeArguments || [];
        if (name === 'PromiseLike' && args.length === 1) return args[0];
        return t;
    };

    const ctxInner = unwrapPromiseLike(ctxType);

    const specifiedType = getSpecifiedGenericTypeArg(checker, call, logger);

    if (ctxInner) {
        if (specifiedType) {
            // specifiedType must be a subtype of unwrapped contextual type
            assertTypeNarrowerThan(checker, specifiedType, ctxInner);
            return specifiedType;
        }
        return ctxInner;
    }

    if (!specifiedType) {
        const error = new Error(
            `[${logger?.getAttribute('location')}] No contextual return type available at site ${siteId}; must specify a return type as a generic parameter!`
        );
        logger?.error(error.message, error);
        throw error;
    }
    // No contextual type: return the specified type as the resolved type
    return specifiedType;
}

export function inferNarrowCallTypeOrThrow(checker: ts.TypeChecker, call: ts.CallExpression): ts.Type {
    const t = checker.getTypeAtLocation(call);
    const f: number = (t as any).flags ?? 0;
    // TypeFlags.Any = 1, Unknown = 1<<1; rely on ts flags value
    const TypeFlagsAny = (ts as any).TypeFlags?.Any ?? 1;
    const TypeFlagsUnknown = (ts as any).TypeFlags?.Unknown ?? 2;
    if (f & TypeFlagsAny || f & TypeFlagsUnknown) {
        throw new Error('magic call type cannot be inferred (any/unknown)');
    }
    return t;
}

export function collectTargetsFromTemplateLiteral(
    checker: ts.TypeChecker,
    call: ts.CallExpression,
    template: ts.TemplateLiteral,
    logger?: ScopedLogger
): {
    functionTargets: FunctionTarget[];
    objectTargets: ObjectTarget[];
    classTargets: ClassTarget[];
} {
    const functionTargets: FunctionTarget[] = [];
    const objectTargets: ObjectTarget[] = [];
    const classTargets: ClassTarget[] = [];

    if (ts.isTemplateExpression(template)) {
        for (const span of template.templateSpans) {
            const expr = span.expression;
            const accessorPath = extractAccessorPath(expr);
            const name = accessorPath[0] || expr.getText();

            validateScopeExpression(expr, checker, call);
            classifyAndCollectTarget(
                expr,
                name,
                accessorPath,
                checker,
                call,
                { functionTargets, objectTargets, classTargets },
                logger
            );
        }
    }

    return { functionTargets, objectTargets, classTargets };
}

export function extractDocstring(node: ts.Node): string | undefined {
    const sourceFile = node.getSourceFile();
    const fullText = sourceFile.getFullText();
    const leadingComments = ts.getLeadingCommentRanges(fullText, node.getFullStart());
    if (leadingComments && leadingComments.length > 0) {
        for (let i = leadingComments.length - 1; i >= 0; i--) {
            const comment = leadingComments[i];
            const commentText = fullText.substring(comment.pos, comment.end);
            if (commentText.trim().startsWith('/**') && commentText.trim().endsWith('*/')) {
                const cleaned = commentText
                    .replace(/^\/\*\*/, '') // Remove opening /**
                    .replace(/\*\/$/, '') // Remove closing */
                    .replace(/^\s*\*\s?/gm, '') // Remove leading * from each line
                    .trim();
                return cleaned;
            }
        }
    }

    return undefined;
}

export function extractDocstringFromSymbol(symbol: ts.Symbol): string | undefined {
    if (!symbol.valueDeclaration && (!symbol.declarations || symbol.declarations.length === 0)) {
        return undefined;
    }

    const decl = symbol.valueDeclaration || symbol.declarations![0];
    return extractDocstring(decl);
}

/**
 * Find the project root by looking for config files.
 * If opts.preferPackageJson is true, first walk up looking ONLY for package.json.
 * If not found, fall back to tsconfig.json or deno.json.
 * Otherwise, treat package.json/tsconfig.json/deno.json equivalently.
 */
export function findProjectRoot(fileName: string, opts?: { preferPackageJson?: boolean }): string {
    const preferPackageJson = !!opts?.preferPackageJson;

    let dir = path.dirname(fileName);
    const root = path.parse(dir).root;

    if (preferPackageJson) {
        // Pass 1: prefer package.json
        while (dir !== root) {
            if (fs.existsSync(path.join(dir, 'package.json'))) {
                return dir;
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }

        // Pass 2: fallback to tsconfig.json or deno.json
        dir = path.dirname(fileName);
        while (dir !== root) {
            if (fs.existsSync(path.join(dir, 'tsconfig.json')) || fs.existsSync(path.join(dir, 'deno.json'))) {
                return dir;
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }

        return path.dirname(fileName);
    }

    // Neutral behavior: any of the known config files
    while (dir !== root) {
        if (
            fs.existsSync(path.join(dir, 'package.json')) ||
            fs.existsSync(path.join(dir, 'tsconfig.json')) ||
            fs.existsSync(path.join(dir, 'deno.json'))
        ) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    return path.dirname(fileName);
}

/**
 * Strip the project root directory from a file path.
 */
export function stripProjectRoot(filePath: string, projectRoot: string): string {
    if (!filePath || !projectRoot) {
        return filePath;
    }

    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(projectRoot);

    // windows?
    if (resolvedPath.startsWith(resolvedRoot)) {
        const relativePath = path.relative(resolvedRoot, resolvedPath);
        return relativePath.split(path.sep).join('/');
    }

    return path.basename(filePath);
}

/**
 * Format a module path to be a valid Python module path.
 */
export function formatModulePath(modulePath: string): string {
    return modulePath
        .replace(/\.(ts|tsx|jsx|json)$/i, '')
        .replace(/@/g, '')
        .replace(/[.-]/g, '_')
        .replace(/\//g, '.');
}
