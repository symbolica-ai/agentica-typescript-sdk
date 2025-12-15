/**
 * OpenTelemetry-focused logger implementation.
 * Emits structured spans and events for distributed tracing.
 * Similar to Python's OTelNotifier.
 */

import type { ScopedLogger, SpanContext } from './types';

import { SpanStatusCode, type Tracer, context, trace } from '@opentelemetry/api';

import { OtelSpanContext } from './span';

/**
 * OtelLogger implements ScopedLogger using OpenTelemetry spans and events.
 * This logger focuses on emitting structured telemetry data for observability.
 */
export class OtelLogger implements ScopedLogger {
    private _tracer: Tracer | null = null;
    private attributes: Record<string, string | number | boolean> = {};

    constructor(
        public scope: string,
        private depth: number = 0,
        private tracerName?: string
    ) {}

    // Lazy-load tracer to ensure TracerProvider is initialized first
    private get tracer(): Tracer {
        if (!this._tracer) {
            this._tracer = trace.getTracer(this.tracerName || this.scope);
        }
        return this._tracer;
    }

    setScope(scope: string): void {
        this.scope = scope;
    }

    debug(message: string, ..._args: any[]): void {
        // Emit as span event for debug-level information
        const activeSpan = trace.getSpan(context.active());
        if (activeSpan) {
            activeSpan.addEvent('debug', {
                'log.level': 'debug',
                'log.scope': this.scope,
                'log.message': message,
                'log.depth': this.depth,
            });
        }
    }

    debugObject(message: string, obj: any): void {
        const activeSpan = trace.getSpan(context.active());
        if (activeSpan) {
            activeSpan.addEvent('debug', {
                'log.level': 'debug',
                'log.scope': this.scope,
                'log.message': message,
                'log.object': JSON.stringify(obj),
                'log.depth': this.depth,
            });
        }
    }

    info(message: string, ..._args: any[]): void {
        const activeSpan = trace.getSpan(context.active());
        if (activeSpan) {
            activeSpan.addEvent('info', {
                'log.level': 'info',
                'log.scope': this.scope,
                'log.message': message,
                'log.depth': this.depth,
            });
        }
    }

    warn(message: string, ..._args: any[]): void {
        const activeSpan = trace.getSpan(context.active());
        if (activeSpan) {
            activeSpan.addEvent('warn', {
                'log.level': 'warn',
                'log.scope': this.scope,
                'log.message': message,
                'log.depth': this.depth,
            });
        }
    }

    error(message: string, error?: Error, ..._args: any[]): void {
        const activeSpan = trace.getSpan(context.active());
        if (activeSpan) {
            if (error) {
                activeSpan.recordException(error);
                activeSpan.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: message,
                });
            }
            activeSpan.addEvent('error', {
                'log.level': 'error',
                'log.scope': this.scope,
                'log.message': message,
                'log.depth': this.depth,
            });
        }
    }

    withScope(childScope: string): ScopedLogger {
        const fullScope = `${this.scope}:${childScope}`;
        return new OtelLogger(fullScope, this.depth);
    }

    withDepth(delta: number): ScopedLogger {
        return new OtelLogger(this.scope, this.depth + delta);
    }

    incDepth(): void {
        this.depth++;
    }

    decDepth(): void {
        if (this.depth > 0) this.depth--;
    }

    setAttribute(key: string, value: string | number | boolean): void {
        const activeSpan = trace.getSpan(context.active());
        if (activeSpan) {
            activeSpan.setAttribute(key, value);
        }
        this.attributes[key] = value;
    }

    getAttribute(key: string): string | number | boolean | undefined {
        return this.attributes[key];
    }

    startSpan(name: string): SpanContext {
        return new OtelSpanContext(this.tracer, name, this.scope);
    }
}
