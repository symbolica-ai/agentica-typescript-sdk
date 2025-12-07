import agentica from '@symbolica/agentica/esbuild';
import { build } from 'esbuild';

await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    sourcemap: true,
    plugins: [agentica()],
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
        // gRPC - server-side only
        '@grpc/grpc-js',
        '@grpc/proto-loader',
    ],
});
