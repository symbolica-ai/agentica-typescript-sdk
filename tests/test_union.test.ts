import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class Fiddler {
    fiddlings: (number | string)[];

    constructor() {
        this.fiddlings = [];
    }

    fiddle(fitem: number | string): boolean {
        this.fiddlings.push(fitem);
        return fitem === 'five';
    }
}

describe('Union Type Demo', () => {
    it('should fiddle with union types until success', async () => {
        const fiddler = new Fiddler();
        const test_fiddlings = ['one', 2, 'three', 4, 'five', 6, 'seven', 8, 'nine', 10];

        const result: string | number | boolean = await agentic(
            'Fiddle with the fiddler using test_fiddlings until you get True, returning the int that does this.',
            { fiddler, test_fiddlings }
        );

        console.log('result:', result);
        expect(result).toBeDefined();
    });
});

/**mock
Let me fiddle around with the fiddler, and good things will happen!

```python
last_fiddling = 0
while not fiddler.fiddle(test_fiddlings[last_fiddling]):
    last_fiddling += 1
```
*/

/**mock
Fiddling worked!

```python
return test_fiddlings[last_fiddling]
```
*/
