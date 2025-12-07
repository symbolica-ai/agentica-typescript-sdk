import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

describe('Dict/Mapping type handling', () => {
    /**mock
    ```python
    the_dict = {"__return_type": str(__return_type), "hello": "world", "foo": "bar"}
    return __return_type(the_dict)
    ```
    */
    it('the return type should be a dict', async () => {
        const result = await agentic<{ [key: string]: string }>('Call getMessage and return the result');
        console.log('Running _emit_stubs:', result);
        expect(result['__return_type']).toContain("class '__main__.AnonymousClass_");
        expect(result['hello']).toBe('world');
        expect(result['foo']).toBe('bar');
    });

    /**mock
    ```python
    return getMessage()
    ```
    */
    it('should correctly handle a simple mapping return type', async () => {
        function getMessage(): { [key: string]: string } {
            return { hello: 'world', foo: 'bar' };
        }
        const result = await agentic<{ [key: string]: string }>('Call getMessage and return the result', {
            getMessage,
        });

        console.log('Running getMessage:', result);

        expect((result as { [key: string]: string })['hello']).toBe('world');
        expect((result as { [key: string]: string })['foo']).toBe('bar');
    });
});
