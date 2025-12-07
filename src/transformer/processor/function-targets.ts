import { SchemaTraversal } from '@transformer/traverser/traverser';
import * as ts from 'typescript';

export interface FunctionTarget {
    scanExpression: ts.Expression;
    name: string;
    accessorPath: string[];
    node: ts.Expression;
    sourceFile: ts.SourceFile;
}

export function processScannedFunctions(
    checker: ts.TypeChecker,
    functionTargets: FunctionTarget[],
    traversal: SchemaTraversal
): void {
    if (!functionTargets.length) return;
    for (const functionTarget of functionTargets) {
        const t = checker.getTypeAtLocation(functionTarget.node);

        traversal.startTraversalAtFunction(
            functionTarget.name,
            functionTarget.accessorPath,
            functionTarget.sourceFile.fileName,
            t,
            functionTarget.node
        );
    }
}
