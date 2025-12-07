import * as ts from 'typescript';

export const SPAWN_TRANSFORMATION_NAME = 'spawnTransformation';
export const CALL_TRANSFORMATION_NAME = 'callTransformation';
export const MAGIC_TRANSFORMATION_NAME = 'agenticTransformation';
export const DEFAULT_TRAVERSAL_DEPTH = 2;

export type RuntimeMappings = Record<string, string>; // Mappings <path>.d.ts -> <path>.js

export function getRuntimeMappings(program: ts.Program): RuntimeMappings {
    const compilerOptions = program.getCompilerOptions() as any;
    return compilerOptions?.runtimeMappings || {};
}

export function getTraversalDepth(program: ts.Program): number {
    const compilerOptions = program.getCompilerOptions() as any;
    return compilerOptions?.traversalDepth ?? DEFAULT_TRAVERSAL_DEPTH;
}
