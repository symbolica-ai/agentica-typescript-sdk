import { spawn } from '@agentica/agent';
import { describe, expect, it } from 'vitest';

class Fiddler {
    fiddlings: number[];

    constructor() {
        this.fiddlings = [];
    }

    fiddle(i: number): boolean {
        this.fiddlings.push(i);
        return i === 1;
    }
}

describe('Fiddler Demo', () => {
    it('should fiddle until success', async () => {
        const fiddler = new Fiddler();
        const agent = await spawn({ premise: 'You are a fiddler.' }, { secret_hint: 'The answer is not 5' });
        await agent.call<number>('Fiddle once and return what does this.', { fiddler });
        const result: string = await agent.call(
            'Now fiddle with the fiddler until you get True, returning the int that does this.',
            { fiddler }
        );

        console.log('result:', typeof result);
        expect(result).toBe('1');
    });
});

/**mock
What's the hint?

```python
secret_hint
```
*/

/**mock
Now let's FIDDLE.

```python
last_fiddling = 0
return fiddler.fiddle(last_fiddling)
```
*/

/**mock
Yay, let's go AGAIN.

```python
while not fiddler.fiddle(last_fiddling):
    last_fiddling += 1
return str(last_fiddling)
```
*/
