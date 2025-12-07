import type { BunPlugin, OnLoadArgs, OnLoadResult } from 'bun';

import { type AgenticaPluginOptions, unpluginFactory } from '../agentica-unplugin';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AgenticaBunPluginOptions extends AgenticaPluginOptions {}

const pluginName = 'bun-plugin-agentica';

/**
 * Bun plugin for Agentica transformer
 *
 * @example
 * ```ts
 * import agenticaPlugin from "@symbolica/agentica/bundlers/bun";
 *
 * Bun.plugin(agenticaPlugin());
 * ```
 */
const agenticaPlugin = (options?: AgenticaBunPluginOptions): BunPlugin => {
    const debug = options?.debug || false;

    // Get the unplugin transformer
    const unplugin = unpluginFactory(options);

    return {
        name: pluginName,
        setup(build) {
            if (debug) {
                console.log(`${pluginName}: Plugin registered`);
            }

            // Register onLoad handler for TypeScript/Svelte files
            // Transform on-demand when files are loaded
            build.onLoad({ filter: /\.(ts|tsx|svelte)$/ }, async (args: OnLoadArgs): Promise<OnLoadResult> => {
                const filePath = args.path;

                if (debug) {
                    console.log(`${pluginName}: onLoad called for ${filePath}`);
                }

                // Check if this file should be transformed
                if (!unplugin.transformInclude(filePath)) {
                    if (debug) {
                        console.log(`${pluginName}: Skipping (not included) ${filePath}`);
                    }
                    // Return original file
                    const contents = await Bun.file(filePath).text();
                    return { contents, loader: 'ts' };
                }

                try {
                    // Read the original file
                    const code = await Bun.file(filePath).text();

                    if (debug) {
                        console.log(`${pluginName}: Transforming ${filePath}`);
                    }

                    // Transform the code
                    const result = await unplugin.transform(code, filePath);

                    if (result && typeof result === 'object' && 'code' in result) {
                        if (debug) {
                            console.log(
                                `${pluginName}: Transformation successful (${code.length} -> ${result.code.length} bytes)`
                            );
                        }
                        return { contents: result.code, loader: 'ts' };
                    }

                    // If transformation returned nothing, return original
                    if (debug) {
                        console.log(`${pluginName}: Transform returned no code, using original`);
                    }
                    return { contents: code, loader: 'ts' };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error(`${pluginName}: Failed to transform ${filePath}: ${message}`);
                    // Return original file on error
                    const contents = await Bun.file(filePath).text();
                    return { contents, loader: 'ts' };
                }
            });

            if (debug) {
                console.log(`${pluginName}: Setup complete`);
            }
        },
    };
};

export default agenticaPlugin;
