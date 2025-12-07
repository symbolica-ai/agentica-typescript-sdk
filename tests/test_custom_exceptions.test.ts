import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class CustomError extends Error {
    constructor(message: string) {
        super(message);
    }
}

describe('Test agent raising custom exceptions back to us', () => {
    /**mock
    I'll create a CustomError...
    ```python
    exc = CustomError("hi")
    ```
    */
    /**mock
    ...and raise it to the user.
    ```python
    raise AgentError(exc)
    ```
    */
    it('should raise the passed in exception', async () => {
        const magicCall = async () => await agentic<number>('Raise CustomError.', { CustomError });
        await expect(magicCall).rejects.toThrowError(CustomError);
    });
});
