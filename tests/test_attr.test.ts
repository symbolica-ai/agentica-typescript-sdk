import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class ClsWithAttr {
    my_attr: string;

    constructor() {
        this.my_attr = 'foo';
    }
}

describe('Attribute Access Demo', () => {
    it('should access attribute of class instance', async () => {
        const my_class = new ClsWithAttr();
        const result = await agenticPro<string>`Return the value of the my_attr attribute of ${my_class}.`();

        console.log('result:', result);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });
});

/**mock
Let me get my_attr

```python
return my_class.my_attr
```
*/
