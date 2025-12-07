/**
 * CompositeLogger combines multiple logger implementations.
 * Similar to Python's HybridNotifier pattern.
 */

import type { ScopedLogger, SpanContext } from './types';

/**
 * Composite span context that delegates to multiple underlying span contexts.
 */
class CompositeSpanContext implements SpanContext {
    constructor(private spans: SpanContext[]) {}

    get spanId(): string {
        // Return the first valid span ID
        return this.spans[0]?.spanId || '00000000000000000000000000000000';
    }

    get traceId(): string {
        // Return the first valid trace ID
        return this.spans[0]?.traceId || '00000000000000000000000000000000';
    }

    setAttribute(key: string, value: string | number | boolean): void {
        for (const span of this.spans) {
            span.setAttribute(key, value);
        }
    }

    recordException(error: Error): void {
        for (const span of this.spans) {
            span.recordException(error);
        }
    }

    end(): void {
        for (const span of this.spans) {
            span.end();
        }
    }

    executeInContext<T>(fn: () => T): T {
        // Use the first span's context (they should all be part of the same trace)
        if (this.spans[0] && 'executeInContext' in this.spans[0]) {
            return (this.spans[0] as any).executeInContext(fn);
        }
        return fn();
    }
}

/**
 * CompositeLogger delegates to multiple logger implementations.
 * This allows combining console logging with OpenTelemetry logging.
 */
export class CompositeLogger implements ScopedLogger {
    constructor(
        private loggers: ScopedLogger[],
        public readonly scope: string
    ) {}

    setScope(_scope: string): void {
        throw new Error('Method not implemented.');
    }

    debug(message: string, ...args: any[]): void {
        for (const logger of this.loggers) {
            logger.debug(message, ...args);
        }
    }

    debugObject(message: string, obj: any): void {
        for (const logger of this.loggers) {
            logger.debugObject(message, obj);
        }
    }

    info(message: string, ...args: any[]): void {
        for (const logger of this.loggers) {
            logger.info(message, ...args);
        }
    }

    warn(message: string, ...args: any[]): void {
        for (const logger of this.loggers) {
            logger.warn(message, ...args);
        }
    }

    error(message: string, error?: Error, ...args: any[]): void {
        for (const logger of this.loggers) {
            logger.error(message, error, ...args);
        }
    }

    withScope(childScope: string): ScopedLogger {
        const childLoggers = this.loggers.map((logger) => logger.withScope(childScope));
        const fullScope = `${this.scope}:${childScope}`;
        return new CompositeLogger(childLoggers, fullScope);
    }

    withDepth(delta: number): ScopedLogger {
        const newLoggers = this.loggers.map((logger) => logger.withDepth(delta));
        return new CompositeLogger(newLoggers, this.scope);
    }

    incDepth(): void {
        for (const logger of this.loggers) {
            logger.incDepth();
        }
    }

    decDepth(): void {
        for (const logger of this.loggers) {
            logger.decDepth();
        }
    }

    setAttribute(key: string, value: string | number | boolean): void {
        for (const logger of this.loggers) {
            logger.setAttribute(key, value);
        }
    }

    getAttribute(key: string): string | number | boolean | undefined {
        // Return the first non-undefined attribute value
        for (const logger of this.loggers) {
            const value = logger.getAttribute(key);
            if (value !== undefined) {
                return value;
            }
        }
        return undefined;
    }

    startSpan(name: string): SpanContext {
        const spans = this.loggers.map((logger) => logger.startSpan(name));
        return new CompositeSpanContext(spans);
    }
}
