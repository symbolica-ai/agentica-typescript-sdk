import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

describe('Exception Demo', () => {
    /**mock
    ```python
    raise AgentError(ValueError("Test error"))
    ```
    */
    it('This should raise a ValueError', async () => {
        const magicFnCall = async () => await agentic<string>('Raise an error');
        await expect(magicFnCall).rejects.toThrowError(ValueError);
    });

    /**mock
    ```python
    raise AgentError(ArithmeticError("2 + 2 = 5"))
    ```
    */
    it('This should raise an error', async () => {
        const magicFnCall = async () => await agentic<string>('Raise an error');
        await expect(magicFnCall).rejects.toThrowError('2 + 2 = 5');
    });
});
