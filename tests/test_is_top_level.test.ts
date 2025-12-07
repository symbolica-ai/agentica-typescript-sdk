import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

// Simple nested types - Inner should be hidden, Outer should be visible
interface Inner {
    value: number;
}

class Outer {
    inner: Inner;

    constructor(inner: Inner) {
        this.inner = inner;
    }

    getValue(): number {
        return this.inner.value;
    }
}

export class HiddenCheck {
    constructor(inner_is_accessible: boolean) {
        this.inner_is_accessible = inner_is_accessible;
    }

    inner_is_accessible: boolean;
}

describe('is_top_level and hidden_names verification', () => {
    it('should hide transitive types from REPL stubs', async () => {
        const result = await agentic<HiddenCheck>('Check hidden locals and return status object', { Outer });

        console.log('Result:', result);

        expect(result.inner_is_accessible).toBe(true);
    });
});

/**mock
```python
inner_is_accessible = False
try:
    Inner
    inner_is_accessible = True
    print("Inner is accessible (unexpected!)")
except NameError:
    inner_is_accessible = False
    print("Inner is not accessible (correct!)")
print(f"Outer is accessible: {Outer is not None}")
```
"""
*/

/**mock
"""
```python
return HiddenCheck(
    inner_is_accessible= inner_is_accessible,
)
```
*/
