import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientSessionManager } from '@/client-session-manager/client-session-manager';
import { AgenticaError, ConnectionError, SDKUnsupportedError } from '@/errors';

describe('ClientSessionManager Error Enrichment', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        // Default mock: registration succeeds
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            } as Response)
        ) as any;
    });

    afterEach(async () => {
        // Give time for any pending async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('should enrich SDKUnsupportedError with sessionId on HTTP 426', async () => {
        const csm = new ClientSessionManager();
        csm.setEndpoints('http://test.example.com', 'ws://test.example.com');

        // Mock fetch: first call for registration (success), second call returns 426
        let callCount = 0;
        global.fetch = vi.fn(() => {
            callCount++;
            if (callCount === 1) {
                // Registration call succeeds
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                } as Response);
            }
            // newAgent call returns 426
            return Promise.resolve({
                ok: false,
                status: 426,
                json: () => Promise.resolve({ detail: 'SDK version 0.1.0 is no longer supported' }),
            } as Response);
        }) as any;

        try {
            await csm.newAgent({
                model: 'test-model',
                warp_globals_payload: new Uint8Array([1, 2, 3]),
                streaming: false,
                json: false,
            });
            expect.fail('Should have thrown SDKUnsupportedError');
        } catch (error: any) {
            expect(error).toBeInstanceOf(SDKUnsupportedError);
            expect(error).toBeInstanceOf(AgenticaError);

            const agenticaError = error as AgenticaError;
            expect(agenticaError.sessionId).toBeDefined();
            expect(agenticaError.errorTimestamp).toBeDefined();
            expect(agenticaError.sessionId).toBe(csm['clientSessionId']);
            expect(agenticaError.toString()).toContain(`Session: ${csm['clientSessionId']}`);
            expect(agenticaError.toString()).toContain('support@symbolica.ai');
        }
    });

    it('should enrich ConnectionError with sessionId on HTTP error', async () => {
        const csm = new ClientSessionManager();
        csm.setEndpoints('http://test.example.com', 'ws://test.example.com');

        // Mock fetch: first call for registration (success), second call returns 500
        let callCount = 0;
        global.fetch = vi.fn(() => {
            callCount++;
            if (callCount === 1) {
                // Registration call succeeds
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                } as Response);
            }
            // newAgent call returns 500
            return Promise.resolve({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: () => Promise.resolve('Server error'),
            } as Response);
        }) as any;

        try {
            await csm.newAgent({
                model: 'test-model',
                warp_globals_payload: new Uint8Array([1, 2, 3]),
                streaming: false,
                json: false,
            });
            expect.fail('Should have thrown ConnectionError');
        } catch (error: any) {
            expect(error).toBeInstanceOf(ConnectionError);

            const agenticaError = error as AgenticaError;
            expect(agenticaError.sessionId).toBe(csm['clientSessionId']);
            expect(agenticaError.errorTimestamp).toBeDefined();
        }
    });

    it('should enrich ConnectionError with sessionId when endpoints not set', async () => {
        const csm = new ClientSessionManager();
        // Don't call setEndpoints - baseHttp/baseWs are null

        try {
            await csm.newAgent({
                model: 'test-model',
                warp_globals_payload: new Uint8Array([1, 2, 3]),
                streaming: false,
                json: false,
            });
            expect.fail('Should have thrown ConnectionError');
        } catch (error: any) {
            expect(error).toBeInstanceOf(ConnectionError);
            expect(error.message).toContain('Base HTTP and WS endpoints must be set');

            const agenticaError = error as AgenticaError;
            expect(agenticaError.sessionId).toBeDefined();
            expect(agenticaError.errorTimestamp).toBeDefined();
        }
    });

    it('should enrich ConnectionError with sessionId during echo on network error', async () => {
        const csm = new ClientSessionManager();
        csm.setEndpoints('http://test.example.com', 'ws://test.example.com');

        const uid = 'test-uid';
        const iid = 'test-iid';

        // Mock fetch: check URL to determine response
        global.fetch = vi.fn((input: RequestInfo | URL) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

            // Echo calls fail (includes '/echo' in path)
            if (url.includes('/echo')) {
                return Promise.reject(new TypeError('fetch failed'));
            }
            // All other calls (including registration) succeed
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
            } as Response);
        }) as any;

        try {
            const generator = csm.echo(new AbortController().signal, uid, iid);
            await generator.next();
            expect.fail('Should have thrown error');
        } catch (error: any) {
            // Echo throws ServerError when fetch fails
            expect(error).toBeInstanceOf(AgenticaError);

            const agenticaError = error as AgenticaError;
            expect(agenticaError.uid).toBe(uid);
            expect(agenticaError.iid).toBe(iid);
            expect(agenticaError.sessionId).toBe(csm['clientSessionId']);
            expect(agenticaError.errorTimestamp).toBeDefined();
        }
    });
});
