import type { TraversalRecord } from './traverser';

import { NoDefMsg, RefMsg } from '@warpc/msg-protocol/concept/concept';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionArgument } from '@warpc/msg-protocol/concept/resource/function-msg';
import { createAtomMsg } from '@warpc/msg-protocol/concept/value/atom';
import * as ts from 'typescript';

import { ANONYMOUS_CLASS, ANONYMOUS_FUNCTION } from '../../warpc/msg-protocol/concept/resource/resource-msg.js';

export type TypeSubstitutionMap = { [typeParamName: string]: RefMsg<ClassMsg> };

export function hasConstructor(t: ts.Type): boolean {
    const sym = t.getSymbol();
    if (!sym) return false;
    return (
        (sym.getDeclarations() &&
            sym.getDeclarations()!.some((decl) => decl.kind === ts.SyntaxKind.ClassDeclaration)) ??
        false
    );
}

export function isEnum(t: ts.Type): boolean {
    const sym = t.getSymbol();
    if (!sym) return false;
    return (
        (sym.getDeclarations() && sym.getDeclarations()!.some((decl) => decl.kind === ts.SyntaxKind.EnumDeclaration)) ??
        false
    );
}

export function deriveFunctionName(t: ts.Type, sig: ts.Signature): string {
    const typeSymbol = t.getSymbol && t.getSymbol();
    if (typeSymbol) {
        const name = typeSymbol.getName();
        if (name && !isBuiltinConcept(name)) {
            return name;
        }
    }
    if (sig.declaration) {
        const d: any = sig.declaration;
        const hasNamedDecl = ts.isMethodSignature(d) || ts.isMethodDeclaration(d) || ts.isFunctionDeclaration(d);
        if (hasNamedDecl && d.name) {
            const dn: any = d.name;
            if (ts.isIdentifier(dn) || ts.isStringLiteral(dn)) {
                const name = dn.text;
                if (name && !isBuiltinConcept(name)) {
                    return name;
                }
            }
        }
    }
    return ANONYMOUS_FUNCTION;
}

export function isBuiltinConcept(name: string): boolean {
    return name.startsWith('__') || name === ANONYMOUS_CLASS;
}

export function isConstructorType(t: ts.Type, checker: ts.TypeChecker): boolean {
    // True constructor/meta-class types have construct signatures
    try {
        const constructSigs = checker.getSignaturesOfType(t, ts.SignatureKind.Construct);
        return constructSigs.length > 0;
    } catch {
        return false;
    }
}

export function substituteTypeParameter(
    parameterType: ts.Type,
    typeSubstitutionMap: TypeSubstitutionMap | undefined,
    _checker: ts.TypeChecker
): RefMsg<ClassMsg> | undefined {
    if (!typeSubstitutionMap || !(parameterType.flags & ts.TypeFlags.TypeParameter)) {
        return undefined;
    }
    const paramSymbol = parameterType.getSymbol();
    const typeParamName = paramSymbol?.getName();
    if (!typeParamName) {
        return undefined;
    }
    return typeSubstitutionMap[typeParamName];
}

export function parseParameterArgument(
    param: ts.Symbol,
    checker: ts.TypeChecker,
    traverseTSType: (t: ts.Type, isDeeper?: boolean, typeNode?: ts.TypeNode) => TraversalRecord,
    precomputedType?: ts.Type,
    typeSubstitutionMap?: TypeSubstitutionMap
): FunctionArgument {
    const decl = (param.valueDeclaration || param.declarations?.[0]) as ts.ParameterDeclaration | undefined;
    const argType =
        precomputedType ??
        (decl
            ? checker.getTypeOfSymbolAtLocation(param, decl)
            : checker.getTypeOfSymbolAtLocation(param, param.valueDeclaration as any));

    let defaultTerm: NoDefMsg | undefined;
    let isOptional = false;
    let isRest = false;

    if (decl && ts.isParameter(decl)) {
        isOptional = decl.questionToken !== undefined;
        isRest = decl.dotDotDotToken !== undefined;

        if (decl.initializer) {
            try {
                let constantValue: any;
                if (decl.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                    constantValue = true;
                } else if (decl.initializer.kind === ts.SyntaxKind.FalseKeyword) {
                    constantValue = false;
                } else if (decl.initializer.kind === ts.SyntaxKind.NullKeyword) {
                    constantValue = null;
                } else if (decl.initializer.kind === ts.SyntaxKind.UndefinedKeyword) {
                    constantValue = undefined;
                } else if (ts.isLiteralExpression(decl.initializer)) {
                    if (ts.isStringLiteral(decl.initializer)) {
                        constantValue = decl.initializer.text;
                    } else if (ts.isNumericLiteral(decl.initializer)) {
                        constantValue = parseFloat(decl.initializer.text);
                    }
                } else if (ts.isIdentifier(decl.initializer)) {
                    const initType = checker.getTypeAtLocation(decl.initializer);
                    if (initType.isStringLiteral()) constantValue = initType.value;
                    else if (initType.isNumberLiteral()) constantValue = initType.value;
                    else if (initType.flags & ts.TypeFlags.BooleanLiteral)
                        constantValue = (initType as any).intrinsicName === 'true';
                }

                if (constantValue !== undefined) {
                    defaultTerm = createAtomMsg(constantValue);
                } else {
                    defaultTerm = undefined;
                }
            } catch {
                defaultTerm = undefined;
            }
        }
    }

    const substitutedType = substituteTypeParameter(argType, typeSubstitutionMap, checker);
    const typeRef = substitutedType ?? ClassMsg.createClassRefMsg(traverseTSType(argType, true, decl?.type).uid);

    return {
        name: param.getName(),
        type: typeRef,
        optional: isOptional,
        default: defaultTerm,
        rest: isRest || undefined,
    };
}
