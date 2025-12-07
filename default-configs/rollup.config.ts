import type { RollupOptions } from 'rollup';

import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import agenticaTransformer from '@symbolica/agentica/transformer';

const config: RollupOptions = {
    input: 'src/index.ts',
    output: {
        file: 'dist/bundle.js',
        format: 'esm',
        inlineDynamicImports: true,
        sourcemap: true,
    },
    external: [
        // Node.js built-ins
        'async_hooks',
        'crypto',
        'fs',
        'http',
        'https',
        'net',
        'tls',
        'zlib',
        'events',
        'stream',
        'util',
        'buffer',
        'url',
        'path',
        // OTEL runtime deps (Node-side, not bundled)
        '@opentelemetry/api',
        '@opentelemetry/core',
        '@opentelemetry/exporter-logs-otlp-grpc',
        '@opentelemetry/exporter-trace-otlp-grpc',
        '@opentelemetry/resources',
        '@opentelemetry/sdk-logs',
        '@opentelemetry/sdk-trace-base',
        '@opentelemetry/sdk-trace-node',
        '@opentelemetry/sdk-trace-web',
        '@opentelemetry/semantic-conventions',
        // gRPC - server-side only
        '@grpc/grpc-js',
        '@grpc/proto-loader',
    ],
    plugins: [
        nodeResolve({ browser: true, preferBuiltins: false }),
        typescript({
            tsconfig: 'tsconfig.json',
            transformers: (program) => ({
                before: [agenticaTransformer(program)],
            }),
        }),
    ],
};

export default config;
