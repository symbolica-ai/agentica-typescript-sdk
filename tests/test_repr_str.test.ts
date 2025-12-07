import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class Cls {
    my_str: string;
    my_num: number;

    constructor(my_str: string, my_num: number) {
        this.my_str = my_str;
        this.my_num = my_num;
    }
}

describe('Repr String Demo', () => {
    /**mock
    Let me construct a Cls and return the repr of the instance.

    ```python
    obj = Cls(my_str='foo', my_num=32)
    return repr(obj)
    ```
    */
    it('should return the repr of the instance', async () => {
        const result = await agentic<string>('Construct a Cls and return the repr of the instance.', { Cls });

        console.log('result:', result);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result).toEqual("Cls(my_str='foo', my_num=32)");
    });

    /**mock
    Let me construct a Cls and return the repr of the instance.

    ```python
    obj = Cls(my_str='foo', my_num=32)
    return str(obj)
    ```
    */
    it('should return the string representation of the instance', async () => {
        const result = await agentic<string>('Return the string representation of the instance.', { Cls });

        console.log('result:', result);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result).toEqual("Cls(my_str='foo', my_num=32)");
    });
});
