import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

import { RequestTooLargeError } from '@/errors';

describe('Test generation errors', () => {
    /**mock error_code=413
    Let me compute the answer to life's deepest question
    */
    it('should raise RequestTooLargeError', async () => {
        const call = async () => await agentic<string>("compute the answer to life's deepest question");
        await expect(call).rejects.toThrow(RequestTooLargeError);
    });
});
