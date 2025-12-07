import { Usage, spawn } from '@agentica/agent';
import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

describe('Usage Stats Tests', () => {
    /**mock
    I'll return 42.

    ```python
    return 42
    ```
    */
    it('should track usage for magic function via callback', async () => {
        let capturedUsage: Usage | null = null;

        const result = await agentic<number>(
            'Return 42.',
            {},
            {
                onUsage: (usage) => {
                    capturedUsage = usage;
                },
            }
        );

        expect(result).toBe(42);
        expect(capturedUsage).not.toBeNull();
        expect(capturedUsage!.inputTokens).toBeGreaterThan(0);
        expect(capturedUsage!.outputTokens).toBeGreaterThan(0);
        expect(capturedUsage!.totalTokens).toBeGreaterThan(0);
    });

    /**mock
    I'll return 42.

    ```python
    return 42
    ```
    */
    it('should track usage for agent single invocation', async () => {
        const agent = await spawn({ premise: 'You are a helpful assistant.' });

        const result = await agent.call<number>('Return 42.');

        expect(result).toBe(42);

        const usage = agent.lastUsage();
        expect(usage.inputTokens).toBeGreaterThan(0);
        expect(usage.outputTokens).toBeGreaterThan(0);
        expect(usage.totalTokens).toBeGreaterThan(0);

        await agent.close();
    });

    /**mock
    I'll return 1.

    ```python
    return 1
    ```
    */
    /**mock
    I'll return 2.

    ```python
    return 2
    ```
    */
    it('should track total usage across multiple agent invocations', async () => {
        const agent = await spawn({ premise: 'You are a helpful assistant.' });

        const result1 = await agent.call<number>('Return 1.');
        expect(result1).toBe(1);
        const usage1 = agent.lastUsage();

        const result2 = await agent.call<number>('Return 2.');
        expect(result2).toBe(2);
        const usage2 = agent.lastUsage();

        const totalUsage = agent.totalUsage();

        // Total should be sum of individual usages
        expect(totalUsage.inputTokens).toBe(usage1.inputTokens + usage2.inputTokens);
        expect(totalUsage.outputTokens).toBe(usage1.outputTokens + usage2.outputTokens);
        expect(totalUsage.totalTokens).toBe(usage1.totalTokens + usage2.totalTokens);

        await agent.close();
    });

    it('should throw when calling lastUsage() before any invocation', async () => {
        const agent = await spawn({ premise: 'You are a helpful assistant.' });

        expect(() => agent.lastUsage()).toThrow('No invocation has been made yet');

        await agent.close();
    });

    it('should return zero usage for totalUsage() before any invocation', async () => {
        const agent = await spawn({ premise: 'You are a helpful assistant.' });

        const total = agent.totalUsage();
        expect(total.inputTokens).toBe(0);
        expect(total.outputTokens).toBe(0);
        expect(total.totalTokens).toBe(0);

        await agent.close();
    });
});

describe('Usage Class Tests', () => {
    it('should create usage with zero()', () => {
        const usage = Usage.zero();
        expect(usage.inputTokens).toBe(0);
        expect(usage.outputTokens).toBe(0);
        expect(usage.totalTokens).toBe(0);
    });

    it('should add usages correctly', () => {
        const usage1 = new Usage(100, 50, 150);
        const usage2 = new Usage(200, 75, 275);

        const sum = usage1.add(usage2);

        expect(sum.inputTokens).toBe(300);
        expect(sum.outputTokens).toBe(125);
        expect(sum.totalTokens).toBe(425);
    });

    it('should subtract usages correctly', () => {
        const usage1 = new Usage(300, 125, 425);
        const usage2 = new Usage(100, 50, 150);

        const diff = usage1.sub(usage2);

        expect(diff.inputTokens).toBe(200);
        expect(diff.outputTokens).toBe(75);
        expect(diff.totalTokens).toBe(275);
    });

    it('should replace values correctly', () => {
        const usage = new Usage(100, 50, 150);

        const replaced = usage.replace({ outputTokens: 0 });

        expect(replaced.inputTokens).toBe(100);
        expect(replaced.outputTokens).toBe(0);
        expect(replaced.totalTokens).toBe(150);
    });

    it('should create from genai usage', () => {
        const genaiUsage = {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
        };

        const usage = Usage.fromCompletions(genaiUsage);

        expect(usage.inputTokens).toBe(100);
        expect(usage.outputTokens).toBe(50);
        expect(usage.totalTokens).toBe(150);
    });

    it('should handle cumulative genai usage', () => {
        const lastUsage = new Usage(100, 50, 150);
        const cumulativeGenaiUsage = {
            prompt_tokens: 250, // cumulative
            completion_tokens: 75, // absolute for this request
            total_tokens: 325, // cumulative
        };

        const usage = Usage.fromCompletions(cumulativeGenaiUsage, lastUsage);

        // Input and total should have cumulation undone
        expect(usage.inputTokens).toBe(150); // 250 - 100
        expect(usage.outputTokens).toBe(75); // absolute, not subtracted
        expect(usage.totalTokens).toBe(175); // 325 - 150
    });
});
