import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

interface MyInterface {
    my_attr: string;
    my_function(bar: string, foo: string): string;
}

class MyClass implements MyInterface {
    my_attr: string;
    my_list: MyInterface[] = [];

    constructor(items: MyInterface[], attr?: string) {
        this.my_attr = attr || 'foo';
        this.my_list.push(...items);
    }

    my_function(bar: string, foo: string): string {
        return bar + foo + this.my_list[0].my_function(bar, foo);
    }
}

describe('Composite Object Demo', () => {
    it('should create class instance and call methods', async () => {
        const obj1 = new MyClass([{ my_attr: 'bar', my_function: (bar: string, foo: string) => bar + foo }], 'baz');
        const my_list = [obj1, obj1];
        const valid_strings = ['bar', 'qux', 'baz', 'quux', 'foo', 'corge'];

        const result = await agentic<string>(
            'Create a new instance of MyClass from list and valid_strings, and call the my_function method to get the result.',
            { my_list, valid_strings }
        );

        console.log('result:', result);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    }, 10_000);
});

/**mock
Let me create a new instance of MyClass with the appropriate arguments.

```python
new_obj = MyClass(my_list, valid_strings[5])
other_obj = MyClass([new_obj] + my_list, valid_strings[4])
other_obj.my_attr = "cat"
```
*/

/**mock
Let me call the my_function method to get the result.

```python
return other_obj.my_function(other_obj.my_attr, valid_strings[3])
```
*/
