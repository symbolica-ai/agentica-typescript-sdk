import type { LogLevel, ScopedLogger } from './types';

import { CompositeLogger } from './composite-logger';
import { globalConfig } from './config';
import { ConsolaLogger } from './logger';
import { OtelLogger } from './otel-logger';

export { ConsolaLogger, shortenPath } from './logger';
export { OtelLogger } from './otel-logger';
export { CompositeLogger } from './composite-logger';
export { globalConfig as loggingConfig } from './config';
export type { LogLevel, LoggerConfig, ScopedLogger, SpanContext } from './types';

/**
 * Create a logger for runtime SDK usage.
 * Returns CompositeLogger (console + OTel) when OTel is enabled, otherwise ConsolaLogger.
 */
export function createLogger(scope: string): ScopedLogger {
    // If OTel logging is enabled, create a composite logger that emits both console and OTel
    if (globalConfig.isOtelLoggingEnabled()) {
        return new CompositeLogger([new ConsolaLogger(scope), new OtelLogger(scope)], scope);
    }
    return new ConsolaLogger(scope);
}

/**
 * Create a console-only logger for build-time usage (e.g., transformer).
 * NEVER uses OTel, even if enabled. Use this for compile-time tools.
 */
export function createConsolaLogger(scope: string): ScopedLogger {
    return new ConsolaLogger(scope);
}

export function setLogLevel(scope: string, level: LogLevel): void {
    globalConfig.setScopeLevel(scope, level);
}

export function setDefaultLogLevel(level: LogLevel): void {
    globalConfig.setDefaultLevel(level);
}
