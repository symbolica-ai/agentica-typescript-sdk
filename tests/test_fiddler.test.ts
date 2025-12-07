import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class Fiddler {
    fiddlings: number[];

    constructor() {
        this.fiddlings = [];
    }

    fiddle(i: number): boolean {
        this.fiddlings.push(i);
        return i === 5;
    }
}

describe('Fiddler Demo', () => {
    it('should fiddle until success', async () => {
        const fiddler = new Fiddler();
        const result = await agentic<number>(
            'Fiddle with the fiddler until you get True, returning the int that does this.',
            { fiddler }
        );

        console.log('result:', result);
        expect(result).toBeDefined();
    });
});

/**mock
Let me fiddle around with the fiddler, and good things will happen!

```python
last_fiddling = 0
while not fiddler.fiddle(last_fiddling):
    last_fiddling += 1
```
*/

/**mock
Fiddling worked!

```python
return last_fiddling
```
*/
