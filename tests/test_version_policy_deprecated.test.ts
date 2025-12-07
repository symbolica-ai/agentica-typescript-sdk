/**
 * Test version policy with a DEPRECATED SDK version.
 *
 * This test expects:
 * - Connection to SUCCEED
 * - Warning to be logged about upgrading (via SDK's logger, not console.warn)
 *
 * The version is dynamically determined by test_version_policy.sh
 * to be at min_supported (deprecated if min_recommended > min_supported).
 *
 * Build with: SETUPTOOLS_SCM_PRETEND_VERSION=X.X.X npm run build
 *
 * Note: The warning is logged via consola.warn() which appears in test logs
 * but cannot be easily captured via vitest which spies on console.warn.
 */

import { spawn } from '@agentica/agent';
import { describe, expect, it } from 'vitest';

describe('Version Policy - Deprecated Version', () => {
    it('should allow deprecated version to connect', async () => {
        const agent = await spawn({
            premise: 'You are a helpful assistant.',
        });

        const result = await agent.call<string>('Say hello');

        // Should still work despite being deprecated
        expect(typeof result).toBe('string');
        expect(result).toBeTruthy();

        console.log('✓ Deprecated version allowed to connect');
        console.log('  (Upgrade warning logged via SDK logger - check logs for "[warn]" messages)');
    });
});

/**mock
Hello world
*/
