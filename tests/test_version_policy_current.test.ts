/**
 * Test version policy with CURRENT SDK version.
 *
 * This test expects:
 * - Connection to SUCCEED
 * - NO warnings
 * - X-Protocol header to be sent
 *
 * Build with: npm run version:sync && npm run build (uses git version)
 */

import { spawn } from '@agentica/agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { version } from '@/version';

describe('Version Policy - Current Version', () => {
    let consoleWarnSpy: any;

    beforeEach(() => {
        consoleWarnSpy = vi.spyOn(console, 'warn');
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    it('should accept current SDK version without warnings', async () => {
        console.log(`Testing with current SDK version: ${version}`);

        const agent = await spawn({
            premise: 'You are a helpful assistant.',
        });

        const result = await agent.call<string>('Say hello');

        // Should work
        expect(typeof result).toBe('string');
        expect(result).toBeTruthy();

        // Should NOT have any SDK-related warnings
        const warningCalls = consoleWarnSpy.mock.calls;
        const sdkWarningFound = warningCalls.some((call: any[]) =>
            call.some(
                (arg) =>
                    typeof arg === 'string' && (arg.includes('SDK update recommended') || arg.includes('deprecated'))
            )
        );

        expect(sdkWarningFound).toBe(false);

        console.log('✓ Current version accepted without warnings');
    });
});

/**mock
Hello world
*/
