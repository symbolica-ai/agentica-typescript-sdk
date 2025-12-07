import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

async function magic_function(bar: string, foo: string) {
    return agentic<string>('Concat bar and foo.', { bar, foo });
}

describe('Nested Magic Functions', () => {
    // TODO: this passes occasionally, but fails because of global mock inference.
    // we skip for now until we fix how mock inference is done for the TypeScript tests.
    it('should call nested magic function with virtual objects', async () => {
        const result = await agentic<string>(
            'Call the magic function with appropriate arguments and return the result.',
            { magic_function }
        );

        console.log('Result:', result);

        // The mock should concatenate and potentially add "spicedup"
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});

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
