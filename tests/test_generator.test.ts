// PASS: 3
// FAIL: 12

import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

function* generator() {
    yield 1;
    yield 2;
    yield 3;
}

describe('Generator Tests', () => {
    /**mock
    Getting Map property.

    ```python
    return [gen.next(), gen.next(), gen.next()]
    ```
    */
    it.fails('should use generator', async () => {
        const gen = generator();
        const result = await agentic<number[]>(`Return the list of generated values from ${gen}.`);
        expect(result).toBeInstanceOf(Array);
        expect(result).toBe([1, 2, 3]);
    });
});
