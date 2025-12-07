import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

import { AgenticaError, RequestTooLargeError } from '@/errors';

describe('Error context for support escalation', () => {
    /**mock error_code=413
    This will trigger a request too large error
    */
    it('should include all context fields in error', async () => {
        try {
            await agentic<number>('trigger an error');
            expect.fail('Expected RequestTooLargeError to be thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(RequestTooLargeError);
            expect(error).toBeInstanceOf(AgenticaError);

            const agenticaError = error as AgenticaError;

            expect(agenticaError.uid).toBeDefined();
            expect(agenticaError.iid).toBeDefined();
            expect(agenticaError.sessionId).toBeDefined();
            expect(agenticaError.sessionManagerId).toBeDefined();
            expect(agenticaError.errorTimestamp).toBeDefined();

            expect(agenticaError.uid!.length).toBeGreaterThan(0);
            expect(agenticaError.iid!.length).toBeGreaterThan(0);
            expect(agenticaError.sessionId!.length).toBeGreaterThan(0);
            expect(agenticaError.sessionManagerId!.length).toBeGreaterThan(0);
            expect(agenticaError.errorTimestamp).toContain('T');

            const errorStr = agenticaError.toString();
            expect(errorStr).toContain(`UID: ${agenticaError.uid}`);
            expect(errorStr).toContain(`IID: ${agenticaError.iid}`);
            expect(errorStr).toContain(`Session: ${agenticaError.sessionId}`);
            expect(errorStr).toContain(`Session Manager ID: ${agenticaError.sessionManagerId}`);
            expect(errorStr).toContain('support@symbolica.ai');
        }
    });
});
