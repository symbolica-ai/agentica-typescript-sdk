/**
 * Test version policy with an UNSUPPORTED SDK version.
 *
 * This test expects the connection to FAIL with a 426 error.
 *
 * The version is dynamically determined by test_version_policy.sh
 * to be below the server's min_supported version.
 *
 * Build with: SETUPTOOLS_SCM_PRETEND_VERSION=X.X.X npm run build
 */

import { spawn } from '@agentica/agent';
import { describe, expect, it } from 'vitest';

describe('Version Policy - Unsupported Version', () => {
    it('should reject unsupported SDK version with 426 error', async () => {
        try {
            const agent = await spawn({
                premise: 'You are a helpful assistant.',
            });

            // If we get here, try to make a call (but it should have failed already)
            await agent.call<string>('This should fail');

            // If we reach this point, the test failed - version was not rejected
            expect.fail('Expected SDK version to be rejected, but connection succeeded');
        } catch (error: any) {
            // Verify the error is about unsupported SDK version
            expect(error.message).toMatch(/SDK VERSION NOT SUPPORTED|SDK version is no longer supported/i);
            console.log('✓ Correctly rejected unsupported SDK version');
            console.log(`  Error: ${error.message}`);
        }
    });
});

/**mock
Should not reach this
*/
