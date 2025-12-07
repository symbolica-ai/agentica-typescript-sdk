import { defineConfig } from 'vitest/config';

// Determine which tests to include based on environment
const includePattern =
    process.env.VITEST_UNIT_ONLY === 'true'
        ? ['./dist/tests/**/*.spec.js']
        : ['./dist/tests/**/*.test.js', './dist/tests/**/*.spec.js'];

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        testTimeout: 5000,
        hookTimeout: 5000,
        teardownTimeout: 8000,
        isolate: false,
        // Run both unit tests (*.spec.js) and integration tests (*.test.js)
        // Or only unit tests if VITEST_UNIT_ONLY=true
        include: includePattern,
        // Override default exclude to allow dist/tests
        exclude: ['**/node_modules/**', '**/dist/src/**', '**/dist/demo/**', '**/dist/bin/**'],
        reporters: process.env.CI ? ['verbose', 'junit'] : ['verbose'],
        outputFile: process.env.CI ? './junit.xml' : undefined,
        // Don't intercept console output - let it stream through immediately
        silent: false,
    },
});
