import type { SpanContext } from './types';

import { type Span, SpanStatusCode, type Tracer, context, trace } from '@opentelemetry/api';

export class OtelSpanContext implements SpanContext {
    private span: Span;

    constructor(
        private tracer: Tracer,
        name: string,
        private parentScope: string
    ) {
        this.span = this.tracer.startSpan(name, {}, context.active());
        this.span.setAttribute('scope', parentScope);
    }

    get spanId(): string {
        return this.span.spanContext().spanId;
    }

    get traceId(): string {
        return this.span.spanContext().traceId;
    }

    setAttribute(key: string, value: string | number | boolean): void {
        this.span.setAttribute(key, value);
    }

    recordException(error: Error): void {
        this.span.recordException(error);
        this.span.setStatus({ code: SpanStatusCode.ERROR });
    }

    end(): void {
        this.span.end();
    }

    executeInContext<T>(fn: () => T): T {
        return context.with(trace.setSpan(context.active(), this.span), fn);
    }
}

export class NoOpSpanContext implements SpanContext {
    readonly spanId: string = '00000000000000000000000000000000';
    readonly traceId: string = '00000000000000000000000000000000';

    setAttribute(): void {}
    recordException(): void {}
    end(): void {}
    executeInContext<T>(fn: () => T): T {
        return fn();
    }
}
