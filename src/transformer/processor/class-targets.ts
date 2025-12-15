import { SchemaTraversal } from '@transformer/traverser/traverser';
import * as ts from 'typescript';

export interface ClassTarget {
    scanExpression: ts.Expression;
    name: string;
    accessorPath: string[];
    classNode: ts.Expression;
    sourceFile: ts.SourceFile;
}

export function processScannedClasses(
    checker: ts.TypeChecker,
    classTargets: ClassTarget[],
    traversal: SchemaTraversal
): void {
    if (!classTargets.length) return;
    for (const target of classTargets) {
        // Derive the instance type regardless of expression shape (identifier, property access, class expr)
        let inputType = checker.getTypeAtLocation(target.classNode);

        const symbolFromName = (target.classNode as any).name
            ? checker.getSymbolAtLocation((target.classNode as any).name)
            : undefined;
        const sym = symbolFromName ?? checker.getSymbolAtLocation(target.classNode as any);
        if (sym && (sym.flags & ts.SymbolFlags.Class) !== 0) {
            try {
                const declared = checker.getDeclaredTypeOfSymbol(sym);
                if (declared) inputType = declared;
            } catch {
                // Ignore type resolution errors
            }
        } else {
            const ctorSigs = checker.getSignaturesOfType(inputType, ts.SignatureKind.Construct);
            if (ctorSigs.length > 0) {
                try {
                    const instanceType = checker.getReturnTypeOfSignature(ctorSigs[0]);
                    if (instanceType) inputType = instanceType;
                } catch {
                    // Ignore signature resolution errors
                }
            }
        }

        traversal.startTraversalAtClass(
            target.name,
            target.accessorPath,
            target.sourceFile.fileName,
            inputType,
            target.classNode
        );
    }
}
