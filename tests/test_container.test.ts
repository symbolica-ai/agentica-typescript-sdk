import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class ClsWithAttr {
    my_list: string[];
    my_set: Set<string>;
    my_map: Map<string, string>;

    constructor() {
        this.my_list = ['foo', 'bar', 'baz'];
        this.my_set = new Set(['foo', 'bar']);
        this.my_map = new Map();
    }

    append(item: string): void {
        this.my_list.push(item);
    }

    shuffle(): void {
        this.my_list = this.my_list.sort(() => Math.random() - 0.5);
    }

    make_map(): void {
        for (const key of this.my_list) {
            const val = Array.from(this.my_set)[Math.floor(Math.random() * this.my_set.size)];
            this.my_map.set(key, val);
        }
    }
}

describe('Container Operations Demo', () => {
    it('should manipulate containers and return result', async () => {
        const my_class = new ClsWithAttr();
        const result = await agentic<number>('Return the value of the my_attr attribute.', { my_class });

        console.log('result:', result);
        expect(result).toBeDefined();
    });
});

/**mock
Let me get my_list

```python
items = my_class.my_list
```
*/

/**mock
Let me get my_set

```python
elements = my_class.my_set
```
*/

/**mock
Let me append an item to my_list

```python
my_class.append('qux')
```
*/

/**mock
Let me shuffle my_class

```python
my_class.shuffle()
```
*/

/**mock
Let me get the first item of my_list

```python
first_item = my_class.my_list[0]
```
*/

/**mock
Let me check whether this is in my_set

```python
is_in = first_item in my_class.my_set
```
*/

/**mock
Let me make a map

```python
my_class.make_map()
```
*/

/**mock
Let me get the map

```python
my_class.my_map
```
*/

/**mock
Let me check how many different values are in my_map
(I need to deduplicate the values)

```python
return len(set(my_class.my_map.values()))
```
*/
