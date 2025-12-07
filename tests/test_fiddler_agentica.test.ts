import { agentic } from '@agentica/agentic';
import { Agentica } from '@agentica-client/index';
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

describe('Fiddler Demo with Agentica Client', () => {
    it.fails('should fiddle until success using Agentica client', async () => {
        const fiddler = new Fiddler();

        const agenticaApiKey = process.env.AGENTICA_API_KEY;
        if (!agenticaApiKey) {
            throw new Error('AGENTICA_API_KEY is not set');
        }
        console.log('Using Agentica client with API key...');
        const client = new Agentica('https://api.agentica.symbolica.ai', agenticaApiKey!);
        const _csm = await client.createSessionManager();
        console.log('✓ Session manager created via Agentica client');

        const result = await agentic<number>(
            'Fiddle with the fiddler until you get True, returning the int that does this.',
            { fiddler }
        );

        console.log('result:', result);
        expect(result).toBeDefined();

        await client.close();
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
