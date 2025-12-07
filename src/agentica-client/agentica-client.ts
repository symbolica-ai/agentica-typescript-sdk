import { ClientSessionManager } from '@client-session-manager/client-session-manager';
import { createLogger } from '@logging/index';

import { version } from '../version';
import { httpToWs } from './utils';

import { ServerError } from '@/errors';

const logger = createLogger('agentica-client');

/**
 * Agentica client for managing sandbox lifecycle and session management.
 */
export class Agentica {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private keepaliveTimers: Map<string, NodeJS.Timeout> = new Map();
    private sessionManager: ClientSessionManager | null = null;

    constructor(baseUrl: string, apiKey: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    /**
     * Create HTTP client with proper headers and base URL.
     */
    private async createHttpClient(): Promise<{
        fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    }> {
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-Protocol': `typescript/${version}`,
        };

        return {
            fetch: (url: string | Request | URL, init?: RequestInit) => {
                let urlStr;
                if (typeof url === 'string') {
                    urlStr = url;
                } else if (url instanceof Request) {
                    urlStr = url.url;
                } else {
                    urlStr = url.toString();
                }
                const fullUrl = urlStr.startsWith('http') ? urlStr : `${this.baseUrl}${urlStr}`;
                return fetch(fullUrl, {
                    ...init,
                    headers: {
                        ...headers,
                        ...init?.headers,
                    },
                });
            },
        };
    }

    /**
     * Create a session manager by provisioning a sandbox.
     */
    async createSessionManager(): Promise<ClientSessionManager> {
        // Each client has one session manager
        if (this.sessionManager) {
            return this.sessionManager;
        }

        const httpClient = await this.createHttpClient();

        // Create sandbox
        const response = await httpClient.fetch('/sandbox', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        if (!response.ok) {
            throw new ServerError(`Failed to create sandbox: ${response.status} "${await response.text()}"`);
        }

        const responseData = await response.json();
        const sandboxId = responseData.sandbox_id;
        const sandboxUrl = responseData.http_url || `${this.baseUrl}/sb-${sandboxId}`;
        const keepaliveIntervalS = responseData.keepalive_interval_s;

        logger.debug(`Created sandbox ${sandboxId} with keepalive interval ${keepaliveIntervalS}s`);

        const sessionManager = new ClientSessionManager({ apiKey: this.apiKey });
        sessionManager.setEndpoints(sandboxUrl, httpToWs(sandboxUrl));

        // Start keepalive timer
        this.startKeepalive(sandboxId, keepaliveIntervalS);

        // Store cleanup callback
        (sessionManager as any).__cleanup = () => this.deleteSandbox(sandboxId);

        this.sessionManager = sessionManager;

        return sessionManager;
    }

    /**
     * Start keepalive timer for a sandbox.
     */
    private startKeepalive(sandboxId: string, intervalS: number): void {
        const timer = setInterval(async () => {
            try {
                const httpClient = await this.createHttpClient();
                await httpClient.fetch(`/sandbox/${sandboxId}/keepalive`, {
                    method: 'POST',
                });
            } catch (error) {
                logger.warn(`Keepalive request failed for sandbox ${sandboxId} with error:`, error);
            }
        }, intervalS * 1000);

        this.keepaliveTimers.set(sandboxId, timer);

        if (typeof timer === 'object' && 'unref' in timer) {
            timer.unref();
        }
    }

    /**
     * Delete a sandbox synchronously.
     */
    private async deleteSandbox(sandboxId: string): Promise<void> {
        try {
            const httpClient = await this.createHttpClient();
            await httpClient.fetch(`/sandbox/${sandboxId}`, {
                method: 'DELETE',
            });

            const timer = this.keepaliveTimers.get(sandboxId);
            if (timer) {
                clearInterval(timer);
                this.keepaliveTimers.delete(sandboxId);
            }
        } catch (error) {
            logger.warn(`Failed to delete sandbox ${sandboxId} with error:`, error);
        }
    }

    /**
     * Cleanup all resources.
     */
    async close(): Promise<void> {
        // Clear all keepalive timers
        for (const [_sandboxId, timer] of this.keepaliveTimers) {
            clearInterval(timer);
        }
        this.keepaliveTimers.clear();
    }
}
