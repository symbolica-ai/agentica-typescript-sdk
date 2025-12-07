import { spawn } from '@agentica/agent';
import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

import { template } from '@/agentica/template';

// Can't actually test prompts from the mock setup from TS.
// Instead we just test we can pass in templates and they don't break anything.
describe('test prompt templates does not break anything', () => {
    /**mock
    I'll return 42.

    ```python
    return 42
    ```
    */
    it('check magic function with template', async () => {
        const result = await agentic<number>(
            'Return 42.',
            { x: 32 },
            { system: template`You have access to [ {{STUBS}} ]` }
        );
        expect(result).toBe(42);
    });

    /**mock
    I'll return 42.

    ```python
    return 42
    ```
    */
    it('check magic function without template', async () => {
        const result = await agentic<number>('Return 42.', { x: 32 }, { system: 'You have access to {{STUBS}}' });
        expect(result).toBe(42);
    });

    /**mock
    I'll return 42.

    ```python
    return 42
    ```
    */
    it('check magic agent with template', async () => {
        const agent = await spawn({ system: template`You have access to {{STUBS}}` }, { y: 99 });
        const result = await agent.call<number>(template`Return 42 of type {{RETURN_TYPE}}\nYou have {{STUBS}}`, {
            x: 32,
        });
        expect(result).toBe(42);
    });

    /**mock
    I'll return 42.

    ```python
    return 42
    ```
    */
    it('check magic agent without template', async () => {
        const agent = await spawn({ system: 'You have access to {{STUBS}}' }, { y: 99 });
        const result = await agent.call<number>('Return 42 of type {{RETURN_TYPE}}\nYou have {{STUBS}}', { x: 32 });
        expect(result).toBe(42);
    });
});
