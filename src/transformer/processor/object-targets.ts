import { SchemaTraversal } from '@transformer/traverser/traverser';
import * as ts from 'typescript';

export interface ObjectTarget {
    scanExpression: ts.Expression;
    name: string;
    accessorPath: string[];
    node: ts.Expression;
    sourceFile: ts.SourceFile;
}

export function processScannedObjects(
    checker: ts.TypeChecker,
    objectTargets: ObjectTarget[],
    traversal: SchemaTraversal
): void {
    if (!objectTargets.length) return;
    for (const objectTarget of objectTargets) {
        const targetType = checker.getTypeAtLocation(objectTarget.node);

        traversal.startTraversalAtObject(
            objectTarget.name,
            objectTarget.accessorPath,
            objectTarget.sourceFile.fileName,
            targetType,
            objectTarget.node
        );
    }
}
