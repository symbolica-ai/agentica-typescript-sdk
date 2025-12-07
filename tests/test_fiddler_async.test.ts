import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class Fiddler {
    fiddlings: number[];

    constructor() {
        this.fiddlings = [];
    }

    async fiddle(i: number): Promise<boolean> {
        this.fiddlings.push(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return i === 5;
    }
}

describe('Fiddler Demo', () => {
    it('should fiddle until success', async () => {
        const fiddler = new Fiddler();
        const result = await agentic<boolean>('Fiddle 5 with the fiddler and return the result.', { fiddler });

        console.log('result:', result);
        expect(result).toBeDefined();
    });
});

/**mock
Fiddling 5 with the fiddler and returning the result.

```python
async def async_fiddle(fiddler: Fiddler) -> bool:
    fiddling = await fiddler.fiddle(5)
    return fiddling

return asyncio.run(async_fiddle(fiddler))
```
*/
