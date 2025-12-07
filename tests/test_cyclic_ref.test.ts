import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

/** My Foo */
class Foo {
    private data: string = '';

    /** Maybe return a Foo */
    maybe(): Foo | undefined {
        return this;
    }

    /**
     * Append text to the data
     * @param text The text to append
     * @returns The Foo
     */
    append(text: string): Foo {
        this.data += text;
        return this; // type: ignore
    }

    /**
     * Get the data
     * @returns The data
     */
    getValue(): string {
        return this.data;
    }
}

describe('Cyclic Ref Tests', () => {
    /**mock
    Calling increment three times.

    ```python
    print(Foo.__annotations__)
    print(Foo.maybe.__annotations__)
    print(Foo.append.__annotations__)
    print(Foo.getValue.__annotations__)
    print(inspect.signature(Foo.maybe))
    print(inspect.signature(Foo.append))
    print(inspect.signature(Foo.getValue))
    print(inspect.isclass(Foo))
    print(inspect.ismethod(Foo.maybe))
    print(inspect.ismethod(Foo.append))
    print(inspect.ismethod(Foo.getValue))
    return obj.maybe().append("hello").append(" world").getValue()
    ```
    */
    it('should chain method calls', async () => {
        const obj = new Foo();
        const result =
            await agenticPro<string>`Call append on ${obj} with "hello", then append " world", then call getValue.`();
        expect(result).toBe('hello world');
    });
});
