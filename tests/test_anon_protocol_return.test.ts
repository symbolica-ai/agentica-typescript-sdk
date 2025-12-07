import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

function functionReturningObject(id: number): { id: number; name: string } {
    return { id, name: `item-${id}` };
}

const arrowReturningObject = (value: string): { data: string } => ({ data: value });

describe('Anonymous Protocol Return Types', () => {
    /**mock
    Getting object result.

    ```python
    return functionReturningObject(42)
    ```
    */
    it('should call function returning anonymous interface object', async () => {
        const result = await agenticPro<{ id: number; name: string }>`Call ${functionReturningObject} with 42.`();
        expect(result).toEqual({ id: 42, name: 'item-42' });
    });

    /**mock
    Arrow returning object.

    ```python
    return arrowReturningObject("test")
    ```
    */
    it('should call arrow function returning anonymous interface object', async () => {
        const result = await agenticPro<{ data: string }>`Call ${arrowReturningObject} with "test".`();
        expect(result).toEqual({ data: 'test' });
    });
});
