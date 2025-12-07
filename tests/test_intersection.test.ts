import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

/**
 * Interface A with method foo
 */
interface HasFoo {
    /**
     * foo method documentation in interface A
     */
    foo(f: boolean): string;
}

/**
 * Interface B with method bar
 */
interface HasBar {
    /**
     * bar method documentation in interface B
     */
    bar(g: string): number;
}

/**
 * A class that implements both interfaces - represents an implementation type
 */
class BothFooAndBar implements HasFoo, HasBar {
    /**
     * foo method documentation in implementation type
     */
    foo(f: boolean): string {
        return f ? 'hello from foo' : 'hello from foo';
    }

    /**
     * bar method documentation in implementation type
     */
    bar(g: string): number {
        g = g ?? 'test';
        void g;
        return 42;
    }
}

/**
 * Function that takes an intersection type (object with both foo and bar)
 */
function processIntersection(obj: HasFoo & HasBar): string {
    return `foo returns: ${obj.foo(true)}, bar returns: ${obj.bar('test')}`;
}

describe('Intersection Type Demo', () => {
    it('should handle intersection types correctly', async () => {
        const instance = new BothFooAndBar();

        const result: string = await agentic('Call processIntersection with the instance and return the result.', {
            processIntersection,
            instance,
            BothFooAndBar,
        });

        console.log('result:', result);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });

    it('should print stubs for intersection types with methods', async () => {
        const instance = new BothFooAndBar();

        // Call format_definition for each type/object to verify the stubs are correct
        const stubBothFooAndBar: string = await agentic(
            'Call format_definition on BothFooAndBar and return the result as a string.',
            { processIntersection, instance, BothFooAndBar }
        );

        const stubHasBar: string = await agentic(
            'Call format_definition on HasBar and return the result as a string.',
            {
                processIntersection,
                instance,
                BothFooAndBar,
            }
        );

        const stubHasFoo: string = await agentic(
            'Call format_definition on HasFoo and return the result as a string.',
            {
                processIntersection,
                instance,
                BothFooAndBar,
            }
        );

        const stubIntersection: string = await agentic(
            'Call format_definition on HasFooAndHasBar and return the result as a string.',
            { processIntersection, instance, BothFooAndBar }
        );

        const stubInstance: string = await agentic(
            'Call format_definition on instance and return the result as a string.',
            { processIntersection, instance, BothFooAndBar }
        );

        const stubProcessIntersection: string = await agentic(
            'Call format_definition on processIntersection and return the result as a string.',
            { processIntersection, instance, BothFooAndBar }
        );

        console.log('BothFooAndBar stub:', stubBothFooAndBar);
        console.log('HasBar stub:', stubHasBar);
        console.log('HasFoo stub:', stubHasFoo);
        console.log('HasFooAndHasBar stub:', stubIntersection);
        console.log('instance stub:', stubInstance);
        console.log('processIntersection stub:', stubProcessIntersection);

        // Expected exact outputs
        const expectedBothFooAndBar = `class BothFooAndBar(HasFoo, HasBar):
    """A class that implements both interfaces - represents an implementation type"""
    def bar(self, g: str) -> int:
        """bar method documentation in implementation type"""
    def foo(self, f: bool) -> str:
        """foo method documentation in implementation type"""`;

        const expectedHasBar = `class HasBar(Protocol):
    """Interface B with method bar"""
    def bar(self, g: str) -> int:
        """bar method documentation in interface B"""`;

        const expectedHasFoo = `class HasFoo(Protocol):
    """Interface A with method foo"""
    def foo(self, f: bool) -> str:
        """foo method documentation in interface A"""`;

        const expectedIntersection = `class HasFooAndHasBar(HasFoo, HasBar):
    """Protocol combining: HasFoo, HasBar"""
    def bar(self, g: str) -> int:
        """bar method documentation in interface B"""
    def foo(self, f: bool) -> str:
        """foo method documentation in interface A"""`;

        const expectedInstance = `instance: BothFooAndBar = BothFooAndBar()

where

class BothFooAndBar(HasFoo, HasBar):
    """A class that implements both interfaces - represents an implementation type"""
    def bar(self, g: str) -> int:
        """bar method documentation in implementation type"""
    def foo(self, f: bool) -> str:
        """foo method documentation in implementation type"""`;

        const expectedProcessIntersection = `def processIntersection(obj: HasFooAndHasBar) -> str:
    """Function that takes an intersection type (object with both foo and bar)"""`;

        // Verify exact matches
        expect(stubBothFooAndBar.trim()).toBe(expectedBothFooAndBar);
        expect(stubHasBar.trim()).toBe(expectedHasBar);
        expect(stubHasFoo.trim()).toBe(expectedHasFoo);
        expect(stubIntersection.trim()).toBe(expectedIntersection);
        expect(stubInstance.trim()).toBe(expectedInstance);
        expect(stubProcessIntersection.trim()).toBe(expectedProcessIntersection);
    });
});

/**mock
I'll call the processIntersection function with the instance.

```python
return processIntersection(instance)
```
*/

/**mock
I'll get the definition of BothFooAndBar.

```python
result, _ = _emit_stubs({'BothFooAndBar': BothFooAndBar}, exclude_private=False)
return result
```
*/

/**mock
I'll get the definition of HasBar.

```python
result, _ = _emit_stubs({'HasBar': HasBar}, exclude_private=False)
return result
```
*/

/**mock
I'll get the definition of HasFoo.

```python
result, _ = _emit_stubs({'HasFoo': HasFoo}, exclude_private=False)
return result
```
*/

/**mock
I'll get the definition of HasFooAndHasBar (the intersection type).

```python
result, _ = _emit_stubs({'HasFooAndHasBar': HasFooAndHasBar}, exclude_private=False)
return result
```
*/

/**mock
I'll get the definition of instance.

```python
result, _ = _emit_stubs({'instance': instance}, exclude_private=False)
return result
```
*/

/**mock
I'll get the definition of processIntersection.

```python
result, _ = _emit_stubs({'processIntersection': processIntersection}, exclude_private=False)
return result
```
*/
