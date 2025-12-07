import { spawn } from '@agentica/agent';
import { agentic } from '@agentica/agentic';
import { MaxTokens } from '@agentica/common';
import { describe, expect, it } from 'vitest';

import { MaxRoundsError, MaxTokensError } from '@/errors/generation';

////////////////////////////////////////////////////////////////////////////////
// Test maximum number of rounds
////////////////////////////////////////////////////////////////////////////////

describe('Maximum Rounds Limits', () => {
    /**mock
    Step 1.

    ```python
    x = 1
    ```
    */
    /**mock
    Step 2.

    ```python
    x = x + 1
    ```
    */
    /**mock
    Step 3.

    ```python
    x = x + 1
    ```
    */
    /**mock
    Done.

    ```python
    return x
    ```
    */
    it('should succeed when under rounds limit', async () => {
        // 4 rounds, limit is 4
        const result = await agentic<number>(
            'Increment x three times then return it.',
            { x: 0 },
            {
                maxTokens: new MaxTokens(100_000, 100_000, 4),
            }
        );
        expect(result).toBe(3);
    });

    /**mock
    Step 1.

    ```python
    x = 1
    ```
    */
    /**mock
    Step 2.

    ```python
    x = x + 1
    ```
    */
    /**mock
    Step 3.

    ```python
    x = x + 1
    ```
    */
    /**mock
    Step 4.

    ```python
    x = x + 1
    ```
    */
    /**mock
    Done.

    ```python
    return x
    ```
    */
    it('should throw MaxRoundsError when over rounds limit', async () => {
        // 5 rounds, limit is 4
        const res = async (): Promise<number> =>
            await agentic<number>(
                'Increment x four times then return it.',
                { x: 0 },
                {
                    maxTokens: new MaxTokens(100_000, 100_000, 4),
                }
            );
        await expect(res).rejects.toThrow(MaxRoundsError);
    });
});

////////////////////////////////////////////////////////////////////////////////
// Test maximum tokens per round of inference
////////////////////////////////////////////////////////////////////////////////

describe('Maximum Tokens Per Round Limits', () => {
    /**mock
    Short response.

    ```python
    return 42
    ```
    */
    it('should succeed when under per-round token limit', async () => {
        const result = await agentic<number>(
            'Return 42.',
            {},
            {
                maxTokens: new MaxTokens(100_000, 1000, null), // 1000 tokens per round
            }
        );
        expect(result).toBe(42);
    });

    /**mock
    This is a very long response that will definitely exceed the token limit that we have set for this test case. We are generating a lot of text here to ensure that the per-round token limit is exceeded. The limit is set to a very small value so even this moderately long response should trigger the MaxTokensError.

    ```python
    return 42
    ```
    */
    it('should throw MaxTokensError when over per-round token limit', async () => {
        // Very low per-round limit that the long mock response will exceed
        const res = async (): Promise<number> =>
            await agentic<number>(
                'Return 42.',
                {},
                {
                    maxTokens: new MaxTokens(100_000, 50, null), // only 50 tokens per round
                }
            );
        await expect(res).rejects.toThrow(MaxTokensError);
    });
});

////////////////////////////////////////////////////////////////////////////////
// Test maximum tokens across an invocation
////////////////////////////////////////////////////////////////////////////////

describe('Maximum Tokens Per Invocation Limits', () => {
    /**mock
    Short.

    ```python
    return 42
    ```
    */
    it('should succeed when under invocation token limit', async () => {
        const result = await agentic<number>(
            'Return 42.',
            {},
            {
                maxTokens: new MaxTokens(10_000, 10_000, null), // high limits
            }
        );
        expect(result).toBe(42);
    });

    /**mock
    First step with some tokens.

    ```python
    x = 1
    ```
    */
    /**mock
    Second step with more tokens.

    ```python
    x = x + 1
    ```
    */
    /**mock
    Third step with even more tokens.

    ```python
    x = x + 1
    ```
    */
    /**mock
    Fourth step to push us over the limit.

    ```python
    return x
    ```
    */
    it('should throw MaxTokensError when over invocation token limit', async () => {
        // Very low invocation limit that multiple rounds will exceed
        const res = async (): Promise<number> =>
            await agentic<number>(
                'Do multiple operations.',
                {},
                {
                    maxTokens: new MaxTokens(100, 1000, null), // only 100 total tokens
                }
            );
        await expect(res).rejects.toThrow(MaxTokensError);
    });
});

////////////////////////////////////////////////////////////////////////////////
// Test agent with usage limits
////////////////////////////////////////////////////////////////////////////////

describe('Agent Usage Limits', () => {
    /**mock
    Done.

    ```python
    return 42
    ```
    */
    it('should work with agent under limits', async () => {
        const agent = await spawn({
            premise: 'You are helpful.',
            maxTokens: new MaxTokens(10_000, 1000, 10),
        });

        const result = await agent.call<number>('Return 42.');
        expect(result).toBe(42);

        await agent.close();
    });

    /**mock
    Step 1.

    ```python
    x = 1
    ```
    */
    /**mock
    Step 2.

    ```python
    x = x + 1
    ```
    */
    /**mock
    Step 3.

    ```python
    return x
    ```
    */
    it('should throw MaxRoundsError for agent over rounds limit', async () => {
        const agent = await spawn({
            premise: 'You are helpful.',
            maxTokens: new MaxTokens(100_000, 100_000, 2), // only 2 rounds allowed
        });

        // 3 rounds needed, limit is 2
        const res = async (): Promise<number> => await agent.call<number>('Increment twice then return.');
        await expect(res).rejects.toThrow(MaxRoundsError);

        await agent.close();
    });
});
