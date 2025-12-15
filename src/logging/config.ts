import type { LogLevel, LoggerConfig } from './types';

import { getLogLevel } from '@bundlers/utils';

const DEFAULT_PRIORITY = 'warn';

const levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4,
};

function parseEnvLogLevel(): { default?: LogLevel; scopes?: Record<string, LogLevel> } {
    const envValue = getLogLevel();
    if (!envValue) return {};

    const parts = envValue.split(',').map((p) => p.trim());
    const result: { default?: LogLevel; scopes?: Record<string, LogLevel> } = {};

    for (const part of parts) {
        if (part.includes(':')) {
            const lastColonIndex = part.lastIndexOf(':');
            const scope = part.substring(0, lastColonIndex);
            const level = part.substring(lastColonIndex + 1);
            if (!result.scopes) result.scopes = {};
            result.scopes[scope] = level as LogLevel;
        } else {
            result.default = part as LogLevel;
        }
    }
    return result;
}

export class LoggingConfig {
    private defaultLevel: LogLevel;
    private scopeLevels: Map<string, LogLevel> = new Map();
    private tracingEnabled: boolean = true;
    private otelLoggingEnabled: boolean = false;

    constructor(config?: LoggerConfig) {
        const envConfig = parseEnvLogLevel();

        this.defaultLevel = config?.defaultLevel ?? envConfig.default ?? DEFAULT_PRIORITY;

        if (envConfig.scopes) {
            for (const [scope, level] of Object.entries(envConfig.scopes)) {
                this.scopeLevels.set(scope, level);
            }
        }
        if (config?.scopeLevels) {
            for (const [scope, level] of Object.entries(config.scopeLevels)) {
                this.scopeLevels.set(scope, level);
            }
        }
        if (config?.enableTracing !== undefined) {
            this.tracingEnabled = config.enableTracing;
        }
        if (config?.enableOtelLogging !== undefined) {
            this.otelLoggingEnabled = config.enableOtelLogging;
        }
    }

    setDefaultLevel(level: LogLevel): void {
        this.defaultLevel = level;
    }

    setScopeLevel(scope: string, level: LogLevel): void {
        this.scopeLevels.set(scope, level);
    }

    getEffectiveLevel(scope: string): LogLevel {
        const parts = scope.split(':');
        for (let i = parts.length; i > 0; i--) {
            const prefix = parts.slice(0, i).join(':');
            const level = this.scopeLevels.get(prefix);
            if (level !== undefined) {
                return level;
            }
        }
        return this.defaultLevel;
    }

    isTracingEnabled(): boolean {
        return this.tracingEnabled;
    }

    isOtelLoggingEnabled(): boolean {
        return this.otelLoggingEnabled;
    }

    setOtelLoggingEnabled(enabled: boolean): void {
        this.otelLoggingEnabled = enabled;
    }

    shouldLog(scope: string, level: LogLevel): boolean {
        const effectiveLevel = this.getEffectiveLevel(scope);
        return levelPriority[level] >= levelPriority[effectiveLevel];
    }
}

export const globalConfig = new LoggingConfig();
