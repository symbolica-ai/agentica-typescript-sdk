import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

describe('Anonymous Type Tests', () => {
    it('should print stub for anonymous interface', async () => {
        const objWithAnonymousInterface: { name: string; value: number } = { name: 'test', value: 123 };

        const stub: string = await agentic(
            'Call format_definition on objWithAnonymousInterface and return the result as a string.',
            { objWithAnonymousInterface }
        );

        console.log('Anonymous interface stub:', stub);
        expect(stub).toBeDefined();
    });
});

/**mock
I'll get the definition of objWithAnonymousInterface.

```python
x = _emit_stubs({'objWithAnonymousInterface': objWithAnonymousInterface}, exclude_private=False)
print(x)
```
*/
/**mock
```python
return x[0]
```
*/
