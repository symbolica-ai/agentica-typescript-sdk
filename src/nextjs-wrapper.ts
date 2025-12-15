import type { NextConfig } from 'next';
import type { WebpackConfigContext } from 'next/dist/server/config-shared';

import { AgenticaPluginOptions, unpluginAgentica } from './agentica-unplugin';

/**
 * Next.js plugin for Agentica transformations.
 * Wraps a Next.js config to add the Agentica webpack loader.
 *
 * @example
 * ```ts
 * import withAgentica from "@symbolica/agentica/next";
 * module.exports = withAgentica({
 *   // your Next.js config
 * });
 * ```
 */
function withAgentica(nextConfig: any = {}, options: AgenticaPluginOptions = {}): NextConfig {
    return {
        ...nextConfig,
        webpack(config: Record<string, unknown>, webpackOptions: WebpackConfigContext) {
            if (Array.isArray(config?.plugins)) {
                config.plugins.unshift(unpluginAgentica.webpack(options));
            }

            if (typeof nextConfig?.webpack === 'function') {
                return nextConfig.webpack(config, webpackOptions) as Record<string, unknown>;
            }

            return config;
        },
    };
}

// Export as both default and named export for compatibility
export default withAgentica;
export { withAgentica };
