/**
 * Bundler-aware environment variable access.
 *
 * Supports:
 * - Node.js: process.env.VAR
 * - Vite: import.meta.env.VITE_VAR (browser) or process.env.VAR (SSR)
 * - Next.js: process.env.NEXT_PUBLIC_VAR (client) or process.env.VAR (server)
 * - Webpack: process.env.VAR (replaced via DefinePlugin at build time)
 * - Rollup: process.env.VAR (replaced via @rollup/plugin-replace at build time)
 * - esbuild: process.env.VAR (replaced via define option at build time)
 *
 * Vite and Next.js require completely static access with no intermediate variables.
 */

export function getAgenticaApiKey(): string | undefined {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AGENTICA_API_KEY) {
        return (import.meta as any).env.VITE_AGENTICA_API_KEY;
    }
    if (typeof process !== 'undefined') {
        return process.env.NEXT_PUBLIC_AGENTICA_API_KEY || process.env.AGENTICA_API_KEY;
    }
    return undefined;
}

export function getAgenticaBaseUrl(): string | undefined {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AGENTICA_BASE_URL) {
        return (import.meta as any).env.VITE_AGENTICA_BASE_URL;
    }
    if (typeof process !== 'undefined') {
        return process.env.NEXT_PUBLIC_AGENTICA_BASE_URL || process.env.AGENTICA_BASE_URL;
    }
    return undefined;
}

export function getSessionManagerBaseUrl(): string | undefined {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_S_M_BASE_URL) {
        return (import.meta as any).env.VITE_S_M_BASE_URL;
    }
    if (typeof process !== 'undefined') {
        return process.env.NEXT_PUBLIC_S_M_BASE_URL || process.env.S_M_BASE_URL;
    }
    return undefined;
}

export function getLogLevel(): string | undefined {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TS_LOG_LEVEL) {
        return (import.meta as any).env.VITE_TS_LOG_LEVEL;
    }
    if (typeof process !== 'undefined') {
        return process.env.NEXT_PUBLIC_TS_LOG_LEVEL || process.env.TS_LOG_LEVEL;
    }
    return undefined;
}
