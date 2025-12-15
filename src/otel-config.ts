/**
 * OpenTelemetry configuration for Agentica TypeScript SDK distributed tracing.
 */

import { Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

// Type that represents either Node or Web tracer provider
type SDKTracerProvider = {
    register: () => void;
    shutdown: () => Promise<void>;
    forceFlush: () => Promise<void>;
};

let _initialized = false;
let _tracerProvider: SDKTracerProvider | null = null;

/**
 * Initialize OpenTelemetry tracing with Tempo backend.
 *
 * @param serviceName - Name of the service for traces
 * @param environment - Environment name (e.g., "production", "staging", "local")
 * @param tempoEndpoint - Tempo OTLP gRPC endpoint (e.g., "http://localhost:4317")
 *                       If not provided, reads from OTEL_EXPORTER_OTLP_ENDPOINT env var
 * @returns TracerProvider instance
 */
export async function initializeTracing(
    serviceName: string = 'agentica-sdk-typescript',
    environment?: string,
    tempoEndpoint?: string
): Promise<SDKTracerProvider> {
    if (_initialized && _tracerProvider) {
        console.warn('OpenTelemetry tracing already initialized, skipping');
        return _tracerProvider;
    }

    // Determine environment
    const env = environment || process.env?.ENVIRONMENT || 'local';

    // Determine OTel Collector endpoint
    const endpoint = tempoEndpoint || process.env?.OTEL_EXPORTER_OTLP_ENDPOINT;

    if (!endpoint && env !== 'local') {
        // No endpoint configured - initialize without exporter
        // This still allows trace context to be injected into headers for distributed tracing
        console.info(
            'OTEL_EXPORTER_OTLP_ENDPOINT not set - spans will not be exported (trace context headers still work)'
        );
    }

    // Create resource with service metadata
    const customResource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: process.env?.SERVICE_VERSION || '0.2.0',
        'deployment.environment': env,
    });
    const resource = defaultResource().merge(customResource);

    // Configure OTLP exporter only if endpoint is provided
    const spanProcessors = [];
    if (endpoint) {
        try {
            const otlpExporter = new OTLPTraceExporter({
                url: endpoint,
            });

            // Use BatchSpanProcessor with tuned settings for better span ordering
            // Longer delay gives parent spans time to complete before children export
            const batchProcessor = new BatchSpanProcessor(otlpExporter, {
                maxQueueSize: 2048, // Larger queue to hold spans (default: 2048)
                scheduledDelayMillis: 2000, // Export every 2 seconds (default: 5000)
                exportTimeoutMillis: 30000, // 30s timeout (default: 30000)
                maxExportBatchSize: 512, // Batch size (default: 512)
            });

            spanProcessors.push(batchProcessor);
        } catch (error) {
            console.error('Failed to initialize OTLP exporter:', error);
            console.warn('Traces will not be sent via OTLP');
        }
    }

    // Create tracer provider with resource and span processors
    // Use environment-specific provider (Node.js vs Browser)
    let tracerProvider: SDKTracerProvider;

    if (typeof process !== 'undefined' && process.versions?.node) {
        // Node.js environment - use dynamic import
        const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node');
        tracerProvider = new NodeTracerProvider({
            resource,
            spanProcessors,
        });
    } else {
        // Browser environment - use dynamic import
        const { WebTracerProvider } = await import('@opentelemetry/sdk-trace-web');
        tracerProvider = new WebTracerProvider({
            resource,
            spanProcessors,
        });
    }

    // Register the global tracer provider
    tracerProvider.register();

    _initialized = true;
    _tracerProvider = tracerProvider;

    return tracerProvider;
}

/**
 * Get a tracer instance.
 *
 * @param name - Name for the tracer (typically module name)
 * @returns Tracer instance
 */
export function getTracer(name: string): ReturnType<typeof trace.getTracer> {
    return trace.getTracer(name);
}

/**
 * Add multiple attributes to a span.
 *
 * @param span - The span to add attributes to
 * @param attributes - Object of attribute key-value pairs
 */
export function addSpanAttributes(span: Span, attributes: Record<string, string | number | boolean>): void {
    for (const [key, value] of Object.entries(attributes)) {
        if (value !== null && value !== undefined) {
            span.setAttribute(key, value);
        }
    }
}

/**
 * Record an exception in a span.
 *
 * @param span - The span to record the exception in
 * @param exception - The exception to record
 */
export function recordException(span: Span, exception: Error): void {
    span.recordException(exception);
    span.setStatus({
        code: SpanStatusCode.ERROR,
        message: exception.message,
    });
}

/**
 * Inject trace context into headers for distributed tracing.
 * Uses the active span from the current context, or from the provided SpanContext.
 *
 * @param headers - Headers object to inject trace context into
 * @param spanContext - Optional SpanContext from logger.startSpan() to inject
 */
export function injectTraceContext(
    headers: Record<string, string>,
    spanContext?: { spanId: string; traceId: string }
): void {
    // Get span context - either from parameter or active span
    let traceId: string;
    let spanId: string;
    let traceFlags: number = 0x01; // Default: sampled
    let traceState: any = undefined;

    if (spanContext) {
        // Use provided span context from logger
        traceId = spanContext.traceId;
        spanId = spanContext.spanId;
    } else {
        // Fall back to active span
        const activeSpan = trace.getActiveSpan();
        if (!activeSpan) return;

        const activeSpanContext = activeSpan.spanContext();
        if (!activeSpanContext) return;

        traceId = activeSpanContext.traceId;
        spanId = activeSpanContext.spanId;
        traceFlags = activeSpanContext.traceFlags;
        traceState = activeSpanContext.traceState;
    }

    // W3C Trace Context format
    headers['traceparent'] = `00-${traceId}-${spanId}-${traceFlags.toString(16).padStart(2, '0')}`;

    if (traceState) {
        headers['tracestate'] = traceState.serialize();
    }
}

/**
 * Get the initialized tracer provider.
 */
export function getTracerProvider(): SDKTracerProvider | null {
    return _tracerProvider;
}

/**
 * Shutdown tracing and flush remaining spans.
 */
export async function shutdownTracing(): Promise<void> {
    if (_tracerProvider) {
        await _tracerProvider.shutdown();
        _tracerProvider = null;
        _initialized = false;
    }
}
