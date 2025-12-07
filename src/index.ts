// Initialize OpenTelemetry tracing at import time (like Python does in __init__.py)
// This ensures TracerProvider is registered before any tracers are created

let _resolveInitTracing: (value: void | PromiseLike<void>) => void = () => {};
export const waitForTracing = new Promise((resolve, _) => {
    _resolveInitTracing = resolve;
});
if (typeof process !== 'undefined' && process.versions?.node) {
    (async () => {
        const { initializeTracing } = await import('./otel-config');
        const { loggingConfig } = await import('./logging');

        try {
            await initializeTracing('agentica-sdk-typescript');

            // Enable OTel logging if explicitly requested
            const otelEnabled = process.env?.OTEL_ENABLED?.toLowerCase() === 'true';
            if (otelEnabled) {
                loggingConfig.setOtelLoggingEnabled(true);
            }
        } catch (error) {
            console.warn('Failed to initialize OpenTelemetry:', error);
        } finally {
            _resolveInitTracing();
        }
    })();
} else {
    // resolve immediately in when not init-ing.
    _resolveInitTracing();
}

// Agentica function exports
export { type AgenticConfig, agentic, agenticPro, agenticTransformation } from './agentica/agentic';
export { Agent, spawn, spawnTransformation } from './agentica/agent';

// Agentica client exports
export { Agentica, getGlobalCsm, getUidForIid } from './agentica-client';

// Logging exports
export { setDefaultLogLevel, setLogLevel } from './logging';

// OpenTelemetry exports
export { getTracer, initializeTracing, shutdownTracing } from './otel-config';
export { CustomLogFW, getLoggerProvider, setupOtelLogging } from './otel-logging';
