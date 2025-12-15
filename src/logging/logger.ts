import type { LogLevel, ScopedLogger } from './types';

import { type Tracer, context, trace } from '@opentelemetry/api';
import { type ConsolaInstance, createConsola } from 'consola';

import { globalConfig } from './config';
import { NoOpSpanContext, OtelSpanContext } from './span';

export function shortenPath(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
}

export class ConsolaLogger implements ScopedLogger {
    private consola: ConsolaInstance;
    private _tracer: Tracer | null = null;
    private attributes: Record<string, string | number | boolean> = {};

    constructor(
        public scope: string,
        private depth: number = 0
    ) {
        this.consola = createConsola({
            level: 999,
            formatOptions: {
                colors: true,
                compact: false,
                date: false,
            },
        });
    }

    setScope(scope: string): void {
        this.scope = scope;
    }

    // Lazy-load tracer to ensure TracerProvider is initialized first
    private get tracer(): Tracer {
        if (!this._tracer) {
            this._tracer = trace.getTracer(this.scope);
        }
        return this._tracer;
    }

    private getIndent(): string {
        return '  '.repeat(this.depth);
    }

    private formatObject(obj: any): string {
        const json = JSON.stringify(obj, null, 2);
        const indentedJson = json ? json.split('\n').join('\n  ') : '';
        return `\n\x1b[2m${indentedJson}\x1b[0m`;
    }

    private getCurrentTraceInfo(): { traceId: string; spanId: string } | null {
        if (!globalConfig.isTracingEnabled()) {
            return null;
        }

        const activeSpan = trace.getSpan(context.active());
        if (!activeSpan) {
            return null;
        }

        const spanContext = activeSpan.spanContext();
        return {
            traceId: spanContext.traceId,
            spanId: spanContext.spanId,
        };
    }

    private formatMessage(level: LogLevel, message: string): string {
        const indent = this.getIndent();
        const traceInfo = this.getCurrentTraceInfo();
        const now = new Date();
        const timestamp =
            now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
            '.' +
            now.getMilliseconds().toString().padStart(3, '0');
        const prefix = `[${timestamp}] [${this.scope}]\n   `;

        if (traceInfo) {
            return `${prefix} ${indent}${message} [trace=${traceInfo.traceId.slice(0, 8)} span=${traceInfo.spanId.slice(0, 8)}]`;
        }

        return `${prefix} ${indent}${message}`;
    }

    private prettyPrintArgs(args: any[]): string {
        return args
            .map((arg) => {
                if (typeof arg === 'object') {
                    return this.formatObject(arg);
                }
                return arg;
            })
            .join('\n');
    }

    debug(message: string, ...args: any[]): void {
        if (!globalConfig.shouldLog(this.scope, 'debug')) {
            return;
        }
        this.consola.debug(this.formatMessage('debug', message), this.prettyPrintArgs(args));
    }

    debugObject(message: string, obj: any): void {
        if (!globalConfig.shouldLog(this.scope, 'debug')) {
            return;
        }
        const formattedObj = obj ? this.formatObject(obj) : '[undefined]';
        this.consola.debug(this.formatMessage('debug', message + formattedObj));
    }

    info(message: string, ...args: any[]): void {
        if (!globalConfig.shouldLog(this.scope, 'info')) {
            return;
        }
        this.consola.info(this.formatMessage('info', message), this.prettyPrintArgs(args));
    }

    warn(message: string, ...args: any[]): void {
        if (!globalConfig.shouldLog(this.scope, 'warn')) {
            return;
        }
        this.consola.warn(this.formatMessage('warn', message), this.prettyPrintArgs(args));
    }

    error(message: string, error?: Error, ...args: any[]): void {
        if (!globalConfig.shouldLog(this.scope, 'error')) {
            return;
        }

        const formattedMessage = this.formatMessage('error', message);

        if (error) {
            this.consola.error(formattedMessage, error, this.prettyPrintArgs(args));
            const activeSpan = trace.getSpan(context.active());
            if (activeSpan) {
                activeSpan.recordException(error);
            }
        } else {
            this.consola.error(formattedMessage, this.prettyPrintArgs(args));
        }
    }

    withScope(childScope: string): ScopedLogger {
        const fullScope = `${this.scope}:${childScope}`;
        return new ConsolaLogger(fullScope, this.depth);
    }

    withDepth(delta: number): ScopedLogger {
        return new ConsolaLogger(this.scope, this.depth + delta);
    }

    incDepth(): void {
        this.depth++;
    }

    decDepth(): void {
        if (this.depth > 0) this.depth--;
    }

    setAttribute(key: string, value: string | number | boolean): void {
        if (!globalConfig.isTracingEnabled()) {
            return;
        }
        const activeSpan = trace.getSpan(context.active());
        if (activeSpan) {
            activeSpan.setAttribute(key, value);
        }
        this.attributes[key] = value;
    }

    getAttribute(key: string): string | number | boolean | undefined {
        return this.attributes[key];
    }

    startSpan(name: string): import('./types').SpanContext {
        if (!globalConfig.isTracingEnabled()) {
            return new NoOpSpanContext();
        }

        return new OtelSpanContext(this.tracer, name, this.scope);
    }
}
