import { spawn } from '@agentica/agent';
import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

import { AGENTICA_CALL_ID } from '@/agentica-client/global-csm';

describe('Parent Tracking for magic functions', () => {
    /**mock
    Let me call the magic function with appropriate arguments.

    ```python
    bar = "foo"
    foo = "bar"
    magic_result = await magic_function(bar, foo)
    ```
    */

    /**mock
    I'm the magic function... let me do my thing.

    ```python
    return bar + foo
    ```
    */

    /**mock
    My magic function worked I think. Let me call it again to be sure.

    ```python
    return await magic_function(bar, foo)
    ```
    */

    /**mock
    I'm the magic function again... this is getting boring.

    ```python
    return bar + foo + "spicedup"
    ```
    */
    it('should call nested magic function with parent tracking', async () => {
        async function magic_function(bar: string, foo: string, callId: string = AGENTICA_CALL_ID): Promise<string> {
            const result = await agentic<string>('Concat bar and foo.', { bar, foo }, { parentCallId: callId });
            console.log('@@@ CALL ID:', callId);
            if (!result || !callId || callId === AGENTICA_CALL_ID) {
                throw new Error('Corrupted result or call ID');
            }
            return callId;
        }
        const result = await agentic<string>(
            'Call the magic function with appropriate arguments and return the result.',
            { magic_function }
        );

        console.log('Result:', result);

        // The mock should concatenate and potentially add "spicedup"
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(30);
    });
});

describe('Parent Tracking for spawned subagents', () => {
    /**mock
    I'll spawn two subagents to complete the tasks.

    ```python
    results = await asyncio.gather(
        runSubAgent("task_a"),
        runSubAgent("task_b")
    )
    return results
    ```
    */

    /**mock
    Completing task A.

    ```python
    return f"Result A: {task}"
    ```
    */

    /**mock
    Completing task B.

    ```python
    return f"Result B: {task}"
    ```
    */
    it('should track parent across spawned subagents', async () => {
        async function runSubAgent(task: string, callId: string = AGENTICA_CALL_ID): Promise<string> {
            const subAgent = await spawn({ premise: 'Complete the task.' });
            const result = await subAgent.call<string>('Do the task.', { task }, { parentCallId: callId });
            await subAgent.close();
            console.log('@@@ CALL ID:', callId);
            if (!result || !callId || callId === AGENTICA_CALL_ID) {
                throw new Error('Corrupted call ID');
            }
            return callId;
        }

        const agent = await spawn({ premise: 'Coordinate two subagents.' });
        const result = await agent.call<string[]>('Spawn two subagents and return results.', { runSubAgent });
        await agent.close();

        console.log('Result:', result);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        expect(result[0].length).toBeGreaterThan(30);
        expect(result[0]).toBe(result[1]);
    });
});
