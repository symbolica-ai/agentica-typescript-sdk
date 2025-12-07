export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface ScopedLogger {
    scope: string;
    debug(message: string, ...args: any[]): void;
    setScope(scope: string): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, error?: Error, ...args: any[]): void;
    debugObject(message: string, obj: any): void;
    withScope(childScope: string): ScopedLogger;
    withDepth(delta: number): ScopedLogger;
    incDepth(): void;
    decDepth(): void;
    setAttribute(key: string, value: string | number | boolean): void;
    getAttribute(key: string): string | number | boolean | undefined;
    startSpan(name: string): SpanContext;
}

export interface SpanContext {
    readonly spanId: string;
    readonly traceId: string;
    setAttribute(key: string, value: string | number | boolean): void;
    recordException(error: Error): void;
    end(): void;
    executeInContext?<T>(fn: () => T): T;
}

export interface LoggerConfig {
    defaultLevel?: LogLevel;
    scopeLevels?: Record<string, LogLevel>;
    enableTracing?: boolean;
    enableOtelLogging?: boolean;
}
