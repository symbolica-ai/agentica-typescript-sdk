import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

/**
 * Type alias for an object with foo property
 */
type WithFoo = {
    foo: string;
};

/**
 * Type alias for an object with bar property
 */
type WithBar = {
    bar: number;
};

/**
 * Function that takes an intersection of two object types
 */
function processData(data: WithFoo & WithBar): string {
    return `foo: ${data.foo}, bar: ${data.bar}`;
}

class ImplementsBothFooAndBar implements WithFoo, WithBar {
    constructor() {
        this.foo = 'hello';
        this.bar = 42;
    }
    foo: string;
    bar: number;
}

describe('Simple Intersection Type Demo', () => {
    it('should handle intersection of object types', async () => {
        const anonymousObject: WithFoo & WithBar = { foo: 'hello', bar: 42 };

        const result: string = await agentic('Call processData with anonymousObject and return the result.', {
            processData,
            anonymousObject,
            ImplementsBothFooAndBar,
        });

        console.log('result:', result);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });

    it('should print stubs for intersection types', async () => {
        const anonymousObject: WithFoo & WithBar = { foo: 'hello', bar: 42 };

        // Call format_definition for each type/object to verify the stubs are correct
        const stubImplementsBothFooAndBar: string = await agentic(
            'Call format_definition on ImplementsBothFooAndBar and return the result as a string.',
            { processData, anonymousObject, ImplementsBothFooAndBar }
        );

        const stubWithBar: string = await agentic(
            'Call format_definition on WithBar and return the result as a string.',
            { processData, anonymousObject, ImplementsBothFooAndBar }
        );

        const stubWithFoo: string = await agentic(
            'Call format_definition on WithFoo and return the result as a string.',
            { processData, anonymousObject, ImplementsBothFooAndBar }
        );

        const stubIntersection: string = await agentic(
            'Call format_definition on WithFooAndWithBar and return the result as a string.',
            { processData, anonymousObject, ImplementsBothFooAndBar }
        );

        const stubAnonymousObject: string = await agentic(
            'Call format_definition on anonymousObject and return the result as a string.',
            { processData, anonymousObject, ImplementsBothFooAndBar }
        );

        const stubProcessData: string = await agentic(
            'Call format_definition on processData and return the result as a string.',
            { processData, anonymousObject, ImplementsBothFooAndBar }
        );

        console.log('ImplementsBothFooAndBar stub:', stubImplementsBothFooAndBar);
        console.log('WithBar stub:', stubWithBar);
        console.log('WithFoo stub:', stubWithFoo);
        console.log('WithFooAndWithBar stub:', stubIntersection);
        console.log('anonymousObject stub:', stubAnonymousObject);
        console.log('processData stub:', stubProcessData);

        // Expected exact outputs
        const expectedImplementsBothFooAndBar = `class ImplementsBothFooAndBar(WithFoo, WithBar):
    bar: int
    foo: str
    def __init__(self, foo: str) -> None:
        """Initialize an instance of WithFoo."""`;

        const expectedWithBar = `class WithBar:
    """Type alias for an object with bar property"""
    bar: int
    def __init__(self, bar: int) -> None:
        """Initialize an instance of WithBar."""`;

        const expectedWithFoo = `class WithFoo:
    """Type alias for an object with foo property"""
    foo: str
    def __init__(self, foo: str) -> None:
        """Initialize an instance of WithFoo."""`;

        const expectedIntersection = `class WithFooAndWithBar(WithFoo, WithBar):
    """Protocol combining: WithFoo, WithBar"""
    bar: int
    foo: str
    def __init__(self, _: Never) -> None:
        """Cannot instantiate WithFooAndWithBar."""`;

        const expectedAnonymousObject = `anonymousObject: WithFooAndWithBar = WithFooAndWithBar(foo='hello', bar=42)

where

class WithFooAndWithBar(WithFoo, WithBar):
    """Protocol combining: WithFoo, WithBar"""
    bar: int
    foo: str
    def __init__(self, _: Never) -> None:
        """Cannot instantiate WithFooAndWithBar."""`;

        const expectedProcessData = `def processData(data: WithFooAndWithBar) -> str:
    """Function that takes an intersection of two object types"""`;

        // Verify exact matches
        expect(stubImplementsBothFooAndBar.trim()).toBe(expectedImplementsBothFooAndBar);
        expect(stubWithBar.trim()).toBe(expectedWithBar);
        expect(stubWithFoo.trim()).toBe(expectedWithFoo);
        expect(stubIntersection.trim()).toBe(expectedIntersection);
        expect(stubAnonymousObject.trim()).toBe(expectedAnonymousObject);
        expect(stubProcessData.trim()).toBe(expectedProcessData);
    });
});

/**mock
I'll call processData with the data object.

```python
x = processData(anonymousObject)
return x
```
*/

/**mock
I'll get the definition of ImplementsBothFooAndBar.

```python
x, _ = _emit_stubs({'ImplementsBothFooAndBar': ImplementsBothFooAndBar}, exclude_private=False)
return x
```
*/

/**mock
I'll get the definition of WithBar.

```python
x, _ = _emit_stubs({'WithBar': WithBar}, exclude_private=False)
return x
```
*/

/**mock
I'll get the definition of WithFoo.

```python
x, _ = _emit_stubs({'WithFoo': WithFoo}, exclude_private=False)
return x
```
*/

/**mock
I'll get the definition of WithFooAndWithBar (the intersection type).

```python
x, _ = _emit_stubs({'WithFooAndWithBar': WithFooAndWithBar}, exclude_private=False)
return x
```
*/

/**mock
I'll get the definition of anonymousObject.

```python
x, _ = _emit_stubs({'anonymousObject': anonymousObject}, exclude_private=False)
return x
```
*/

/**mock
I'll get the definition of processData.

```python
x, _ = _emit_stubs({'processData': processData}, exclude_private=False)
return x
```
*/
