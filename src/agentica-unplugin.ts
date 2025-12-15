import agenticFunTransformer from '@transformer/transformer';
import { dirname, resolve } from 'pathe';
import { resolveTSConfig } from 'pkg-types';
import * as ts from 'typescript';
import { createUnplugin } from 'unplugin';

export interface AgenticaPluginOptions {
    /** Enable debug logging */
    debug?: boolean;
    /** TypeScript compiler options override */
    compilerOptions?: ts.CompilerOptions;
}

/**
 * Svelte files need special handling because unlike TSX (where JSX is part of TypeScript's syntax),
 * Svelte uses separate <script>, <style>, and template sections that aren't valid TypeScript.
 * We extract the <script lang="ts"> content, transform it, then reconstruct the file.
 */

interface ScriptExtraction {
    content: string;
    prefix: string;
    suffix: string;
}

function extractScriptFromSvelte(code: string): ScriptExtraction | null {
    const scriptMatch = code.match(/<script\s+lang=["']ts["'][^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return null;

    const scriptStart = scriptMatch.index! + scriptMatch[0].indexOf('>') + 1;
    const scriptEnd = scriptStart + scriptMatch[1].length;
    return {
        content: scriptMatch[1],
        prefix: code.substring(0, scriptStart),
        suffix: code.substring(scriptEnd),
    };
}

function reconstructSvelte(extraction: ScriptExtraction, transformedScript: string): string {
    return extraction.prefix + transformedScript + extraction.suffix;
}

export const unpluginFactory = (options?: AgenticaPluginOptions) => {
    const debug = options?.debug || false;

    return {
        name: 'unplugin-agentica',

        enforce: 'pre' as const, // Makes transformer run before SWC removes all type information

        transformInclude(id: string) {
            // Transform TypeScript and Svelte files
            return id.endsWith('.ts') || id.endsWith('.tsx') || id.endsWith('.svelte');
        },

        async transform(code: string, id: string) {
            try {
                if (id.includes('?')) return null;

                const isSvelte = id.endsWith('.svelte');
                let scriptContent = code;
                let svelteExtraction: ScriptExtraction | null = null;

                if (isSvelte) {
                    svelteExtraction = extractScriptFromSvelte(code);
                    if (!svelteExtraction) return null;
                    scriptContent = svelteExtraction.content;
                }

                if (debug) {
                    console.log(`[unplugin-agentica] Transforming: ${id}`);
                    const agenticCallMatch = scriptContent.match(/agentic[^(]*\([^)]*\)/);
                    if (agenticCallMatch) {
                        console.log(`[unplugin-agentica] Agentic call found:`, agenticCallMatch[0]);
                    }
                    if (isSvelte) console.log(`[unplugin-agentica] Extracted script from Svelte`);
                }

                // Create a minimal TypeScript program for this file
                const compilerOptions: ts.CompilerOptions = {
                    ...(await getTsCompilerOption()),
                    ...options?.compilerOptions,
                };

                const virtualFileName = isSvelte ? id.replace('.svelte', '.ts') : id;
                const sourceFile = ts.createSourceFile(
                    virtualFileName,
                    scriptContent,
                    compilerOptions.target ?? ts.ScriptTarget.ES2020
                );

                const host: ts.CompilerHost = ts.createCompilerHost(compilerOptions);

                // Override getSourceFile to return our transformed source
                const originalGetSourceFile = host.getSourceFile.bind(host);
                host.getSourceFile = (fileName, ...args) => {
                    if (fileName === virtualFileName || fileName === id) return sourceFile;
                    return originalGetSourceFile(fileName, ...args);
                };

                // Create a program with full type information
                const program = ts.createProgram([virtualFileName], compilerOptions, host);

                // Get our transformer
                const transformer = agenticFunTransformer(program);

                // Transform the source file
                const result = ts.transform(sourceFile, [transformer]);
                const transformedSourceFile = result.transformed[0] as ts.SourceFile;

                // Print the transformed code
                const printer = ts.createPrinter();
                const transformedScript = printer.printFile(transformedSourceFile);
                result.dispose();

                if (debug) {
                    console.log(`[unplugin-agentica] Transformed ${id}`);
                    console.log(`[unplugin-agentica] Original: ${scriptContent.length} chars`);
                    console.log(`[unplugin-agentica] Transformed: ${transformedScript.length} chars`);
                }

                const transformedCode = svelteExtraction
                    ? reconstructSvelte(svelteExtraction, transformedScript)
                    : transformedScript;

                return {
                    code: transformedCode,
                    map: null,
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`[unplugin-agentica] Failed to transform ${id}: ${message}`);
            }
        },
    };
};

async function getTsCompilerOption(tsconfigId?: string): Promise<ts.CompilerOptions> {
    const readFile = (path: string) => ts.sys.readFile(path);

    let id: string;
    try {
        id = tsconfigId != null ? resolve(tsconfigId) : await resolveTSConfig();
    } catch {
        throw new Error(
            'Agentica requires a tsconfig.json file in your project.\n' +
                'Please initialize your TypeScript project:\n' +
                '  npm init -y\n' +
                '  npx tsc --init\n' +
                'Or run: npx agentica-setup'
        );
    }

    const tsconfigParseResult = ts.readConfigFile(id, readFile);
    if (tsconfigParseResult.error != null) {
        throw new Error(`Failed to parse tsconfig.json: ${tsconfigParseResult.error.messageText.toString()}`);
    }

    const baseDir = dirname(id);
    const tsconfig = ts.parseJsonConfigFileContent(tsconfigParseResult.config, ts.sys, baseDir);

    // Merge compilerOptions from referenced tsconfigs if present
    const refs = tsconfigParseResult.config?.references as Array<{ path: string }> | undefined;
    if (Array.isArray(refs)) {
        for (const ref of refs) {
            try {
                const refDir = resolve(baseDir, ref.path);
                const refFile = ts.sys.fileExists(resolve(refDir, 'tsconfig.json'))
                    ? resolve(refDir, 'tsconfig.json')
                    : refDir;
                const refRead = ts.readConfigFile(refFile, readFile);
                if (!refRead.error) {
                    const refCfg = ts.parseJsonConfigFileContent(refRead.config, ts.sys, dirname(refFile));
                    Object.assign(tsconfig.options, refCfg.options);
                }
            } catch {
                // Ignore referenced config parse errors
            }
        }
    }

    return tsconfig.options;
}

export const unpluginAgentica = /* #__PURE__ */ createUnplugin<AgenticaPluginOptions | undefined>(unpluginFactory);

// Export for different bundlers
export const vite = unpluginAgentica.vite;
export const webpack = unpluginAgentica.webpack;
export const rollup = unpluginAgentica.rollup;
export const esbuild = unpluginAgentica.esbuild;
export default unpluginAgentica;
