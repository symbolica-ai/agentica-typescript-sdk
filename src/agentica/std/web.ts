/**
 * Exa.ai web search client with rate limiting and ephemeral key management.
 *
 * Environment variables:
 * - EXA_API_KEY: Regular API key
 * - EXA_SERVICE_API_KEY: Service key for creating ephemeral keys
 */

import type { SearchResult as ExaSearchResult } from 'exa-js';

import Exa from 'exa-js';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SearchResultData {
    title: string;
    url: string;
    contentLines: string[];
    score?: number;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Exa rate limit exceeded.
 */
export class ExaRateLimitError extends Error {
    retryAfter?: number;

    constructor(retryAfter?: number) {
        const message = retryAfter
            ? `Rate limit exceeded (retry after ${retryAfter.toFixed(1)}s)`
            : 'Rate limit exceeded';
        super(message);
        this.name = 'ExaRateLimitError';
        this.retryAfter = retryAfter;
    }
}

// ============================================================================
// SearchResult
// ============================================================================

/**
 * A single search result from Exa.
 */
export class SearchResult {
    readonly title: string;
    readonly url: string;
    readonly score?: number;
    readonly contentLines: string[];

    constructor(data: SearchResultData) {
        this.title = data.title;
        this.url = data.url;
        this.contentLines = data.contentLines;
        this.score = data.score;
    }

    /**
     * Number of content lines.
     */
    get numLines(): number {
        return this.contentLines.length;
    }

    /**
     * Return the content of the search result with line numbers.
     * Optionally, specify the start and end lines to return (1-indexed, inclusive).
     */
    contentWithLineNumbers(start = 1, end?: number): string {
        const startIdx = Math.max(start, 1);
        const lines = this.contentLines.slice(startIdx - 1, end);
        return lines.map((line, idx) => `${startIdx + idx}: ${line}`).join('\n');
    }

    /**
     * Convert to plain object for serialization.
     */
    toDict(): SearchResultData {
        return {
            title: this.title,
            url: this.url,
            contentLines: this.contentLines,
            score: this.score,
        };
    }

    toJSON(): SearchResultData {
        return this.toDict();
    }

    /**
     * Serialize to a JSON string.
     */
    toJSONString(): string {
        return JSON.stringify(this.toJSON());
    }

    /**
     * Create from JSON string.
     */
    static fromJSON(json: string): SearchResult {
        const data = JSON.parse(json) as SearchResultData;
        return new SearchResult(data);
    }

    toString(): string {
        return `SearchResult(title=${JSON.stringify(this.title)}, url=${JSON.stringify(this.url)}, score=${this.score}, numLines=${this.numLines})`;
    }
}

/**
 * Create a SearchResult from an Exa API result.
 * @param r - The Exa API result.
 * @returns The SearchResult.
 */
function fromExa(r: ExaSearchResult<{ text: true }>): SearchResult {
    return new SearchResult({
        title: r.title ?? '<no title>',
        url: r.url,
        contentLines: (r.text ?? '').split('\n'),
        score: r.score ?? undefined,
    });
}

// ============================================================================
// Rate Limiter
// ============================================================================

/**
 * N requests per second window rate limiter.
 */
class RateLimiter {
    private maxRequests: number;
    private window: number;
    private count = 0;
    private windowStart = 0;
    private pending: Array<() => void> = [];
    private processing = false;

    constructor(maxRequests = 5, window = 1000) {
        this.maxRequests = maxRequests;
        this.window = window; // in milliseconds
    }

    async acquire(): Promise<void> {
        return new Promise((resolve) => {
            this.pending.push(resolve);
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        while (this.pending.length > 0) {
            const now = Date.now();

            // Reset window if expired
            if (now - this.windowStart >= this.window) {
                this.windowStart = now;
                this.count = 0;
            }

            // If at capacity, wait for window to reset
            if (this.count >= this.maxRequests) {
                const sleepTime = this.window - (now - this.windowStart);
                if (sleepTime > 0) {
                    await this.sleep(sleepTime);
                }
                this.windowStart = Date.now();
                this.count = 0;
            }

            // Process next request
            const next = this.pending.shift();
            if (next) {
                this.count++;
                next();
            }
        }

        this.processing = false;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

const API_KEY_PREFIX = 'agentica_web';

// ============================================================================
// ExaClient
// ============================================================================

export interface ExaClientOptions {
    apiKey?: string;
    maxRetries?: number;
    rateLimit?: number;
}

/**
 * Rate-limited Exa client with retry on rate limit errors.
 */
export class ExaClient {
    private readonly apiKey: string;
    private readonly exa: Exa;
    private readonly maxRetries: number;
    private readonly rateLimiter: RateLimiter;

    constructor(options: ExaClientOptions = {}) {
        const key = options.apiKey ?? process.env.EXA_API_KEY;
        if (!key) {
            throw new Error('No API key. Set EXA_API_KEY or pass apiKey option');
        }
        this.apiKey = key;
        this.exa = new Exa(key);
        this.maxRetries = options.maxRetries ?? 3;
        this.rateLimiter = new RateLimiter(options.rateLimit ?? 5, 1000);
    }

    /**
     * Search the web using Exa.
     */
    async search(query: string, options: { numResults?: number; includeText?: boolean } = {}): Promise<SearchResult[]> {
        const { numResults = 5, includeText = true } = options;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                await this.rateLimiter.acquire();

                if (includeText) {
                    const response = await this.exa.searchAndContents(query, {
                        numResults,
                        text: true,
                    });
                    return response.results.map((r) => fromExa(r as ExaSearchResult<{ text: true }>));
                } else {
                    const response = await this.exa.search(query, { numResults });
                    return response.results.map(
                        (r) =>
                            new SearchResult({
                                title: r.title ?? '<no title>',
                                url: r.url,
                                contentLines: [],
                                score: undefined,
                            })
                    );
                }
            } catch (e) {
                const err = String(e).toLowerCase();
                if (err.includes('rate') || err.includes('429') || err.includes('limit')) {
                    if (attempt < this.maxRetries) {
                        await this.sleep(1000 * (attempt + 1));
                        continue;
                    }
                    throw new ExaRateLimitError();
                }
                throw e;
            }
        }

        throw new ExaRateLimitError();
    }

    /**
     * Fetch content from a specific URL.
     */
    async fetch(url: string): Promise<SearchResult> {
        await this.rateLimiter.acquire();

        const response = await this.exa.getContents([url], { text: true });
        if (!response.results || response.results.length === 0) {
            throw new Error(`No content for URL: ${url}`);
        }

        return fromExa(response.results[0] as ExaSearchResult<{ text: true }>);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// ============================================================================
// ExaAdmin
// ============================================================================

export interface ApiKeyInfo {
    id: string;
    name?: string;
    [key: string]: unknown;
}

/**
 * Exa Admin API for managing API keys.
 *
 * Requires EXA_SERVICE_API_KEY with permissions to create/delete keys.
 * See: https://docs.exa.ai/reference/team-management/create-api-key
 */
export class ExaAdmin {
    static readonly BASE_URL = 'https://admin-api.exa.ai/team-management/api-keys';

    private readonly serviceKey: string;

    constructor(serviceKey?: string) {
        const key = serviceKey ?? process.env.EXA_SERVICE_API_KEY;
        if (!key) {
            throw new Error('No service key. Set EXA_SERVICE_API_KEY or pass serviceKey');
        }
        this.serviceKey = key;
    }

    private async request<T>(method: 'GET' | 'POST' | 'DELETE', path = '', body?: object): Promise<T> {
        const url = `${ExaAdmin.BASE_URL}${path}`;
        const options: RequestInit = {
            method,
            headers: {
                'x-api-key': this.serviceKey,
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Admin API error: ${response.status} ${text}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Create a new API key.
     */
    async createKey(name?: string): Promise<string> {
        const keyName = name ?? `${API_KEY_PREFIX}_${formatTimestamp(new Date())}`;

        const result = await this.request<{ apiKey?: { id?: string } }>('POST', '', { name: keyName });

        const apiKey = result.apiKey?.id;
        if (!apiKey) {
            throw new Error(`No key in response: ${JSON.stringify(result)}`);
        }

        return apiKey;
    }

    /**
     * List all API keys.
     */
    async listKeys(): Promise<ApiKeyInfo[]> {
        const result = await this.request<{ apiKeys?: ApiKeyInfo[] }>('GET');
        return result.apiKeys ?? [];
    }

    /**
     * Delete an API key by ID.
     */
    async deleteKey(keyId: string): Promise<boolean> {
        try {
            await this.request('DELETE', `/${keyId}`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete all keys matching a prefix.
     */
    async pruneKeys(prefix = API_KEY_PREFIX): Promise<number> {
        const keys = await this.listKeys();
        let deleted = 0;

        for (const key of keys) {
            if (key.name?.startsWith(prefix) && key.id) {
                if (await this.deleteKey(key.id)) {
                    deleted++;
                }
            }
        }

        return deleted;
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

let defaultClient: ExaClient | null = null;

function getDefaultClient(): ExaClient {
    if (!defaultClient) {
        defaultClient = new ExaClient();
    }
    return defaultClient;
}

/**
 * Search the web. Uses EXA_API_KEY.
 */
export async function webSearch(query: string, numResults = 5): Promise<SearchResult[]> {
    return getDefaultClient().search(query, { numResults });
}

/**
 * Fetch content from a URL. Uses EXA_API_KEY.
 */
export async function webFetch(url: string): Promise<SearchResult> {
    return getDefaultClient().fetch(url);
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
        `${date.getFullYear()}` +
        `${pad(date.getMonth() + 1)}` +
        `${pad(date.getDate())}` +
        `${pad(date.getHours())}` +
        `${pad(date.getMinutes())}` +
        `${pad(date.getSeconds())}`
    );
}
