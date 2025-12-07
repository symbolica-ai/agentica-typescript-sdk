/**
 * OpenTelemetry logging framework for sending logs to session manager via OTEL Collector.
 *
 * This module provides a simple interface to set up OpenTelemetry logging
 * with OTLP export capabilities, allowing logs to be sent to the session manager's
 * OpenTelemetry Collector for unified observability.
 *
 * Similar to Python's CustomLogFW in agentica_internal/otel_logging.py
 */

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let _loggerProvider: LoggerProvider | null = null;

/**
 * CustomLogFW sets up logging using OpenTelemetry with a specified service name and instance ID.
 *
 * This class configures the OpenTelemetry logging pipeline to send logs to an OTLP endpoint
 * (typically the session manager's OTel collector) which can then forward them to Loki or other backends.
 */
export class CustomLogFW {
    private serviceName: string;
    private instanceId: string;
    private endpoint: string;
    private _insecure: boolean;
    public loggerProvider: LoggerProvider;

    constructor(serviceName: string, instanceId: string, endpoint?: string, insecure: boolean = true) {
        this.serviceName = serviceName;
        this.instanceId = instanceId;

        // Determine endpoint - default to session manager's collector
        this.endpoint = endpoint || process.env?.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
        this._insecure = insecure;

        // Create LoggerProvider with resource attributes
        const resource = resourceFromAttributes({
            [ATTR_SERVICE_NAME]: serviceName,
            'service.instance.id': instanceId,
            'deployment.environment': process.env?.ENVIRONMENT || 'local',
        });

        this.loggerProvider = new LoggerProvider({ resource });
    }

    /**
     * Set up the logging configuration with OTLP export.
     *
     * This method:
     * 1. Creates an OTLP log exporter
     * 2. Configures a batch processor
     * 3. Recreates the logger provider with the processor
     *
     * @returns LoggerProvider instance configured for OTLP export
     */
    setupLogging(): LoggerProvider {
        try {
            // Enable diagnostics for debugging
            if (process.env?.OTEL_LOG_LEVEL === 'debug') {
                diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
            }

            // Create OTLP log exporter
            const exporter = new OTLPLogExporter({
                url: this.endpoint,
            });

            // Create batch processor for better performance
            const batchProcessor = new BatchLogRecordProcessor(exporter);

            // Recreate logger provider with resource and processor
            const resource = resourceFromAttributes({
                [ATTR_SERVICE_NAME]: this.serviceName,
                'service.instance.id': this.instanceId,
                'deployment.environment': process.env?.ENVIRONMENT || 'local',
            });

            this.loggerProvider = new LoggerProvider({
                resource,
                processors: [batchProcessor],
            });

            console.info(
                `OpenTelemetry logging initialized: service=${this.serviceName}, ` +
                    `instance=${this.instanceId}, endpoint=${this.endpoint}`
            );

            return this.loggerProvider;
        } catch (error) {
            console.error('Failed to set up OpenTelemetry logging:', error);
            console.warn('Logs will not be sent via OTLP');
            return this.loggerProvider;
        }
    }
}

/**
 * Convenience function to quickly set up OTEL logging.
 *
 * @param serviceName - Name of the service for logging purposes
 * @param instanceId - Unique instance ID of the service
 * @param endpoint - OTLP endpoint URL (optional, uses env var or default)
 * @returns LoggerProvider instance
 */
export function setupOtelLogging(serviceName: string, instanceId: string, endpoint?: string): LoggerProvider {
    const logFW = new CustomLogFW(serviceName, instanceId, endpoint);
    const provider = logFW.setupLogging();
    _loggerProvider = provider;
    return provider;
}

/**
 * Get the initialized logger provider.
 */
export function getLoggerProvider(): LoggerProvider | null {
    return _loggerProvider;
}
