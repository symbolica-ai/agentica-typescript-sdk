import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

function identity<T>(value: T): T {
    return value;
}

function firstElement<T>(array: T[]): T | undefined {
    return array[0];
}

function pairValues<T, U>(first: T, second: U): [T, U] {
    return [first, second];
}

function mapArray<T, U>(array: T[], mapper: (item: T) => U): U[] {
    return array.map(mapper);
}

describe('Generic Functions Tests', () => {
    /**mock
    Identity with string.

    ```python
    try:
        return identity("test")
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should call generic identity function with string', async () => {
        const result = await agenticPro<string>`Call ${identity} with "test".`();
        expect(result).toBe('test');
    });

    /**mock
    Identity with number.

    ```python
    try:
        return identity(42)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should call generic identity function with number', async () => {
        const result = await agenticPro<number>`Call ${identity} with 42.`();
        expect(result).toBe(42);
    });

    /**mock
    Identity with object.

    ```python
    try:
        return identity(obj)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should call generic identity function with object', async () => {
        const obj = { name: 'test', value: 123 };
        const result = await agenticPro<typeof obj>`Call ${identity} with ${obj}.`();
        expect(result).toEqual(obj);
    });

    /**mock
    First element from array.

    ```python
    try:
        return firstElement(arr)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should call generic function with array parameter', async () => {
        const arr = [1, 2, 3, 4, 5];
        const result = await agenticPro<number>`Call ${firstElement} with ${arr}.`();
        expect(result).toBe(1);
    });

    /**mock
    Pair values with two types.

    ```python
    try:
        return pairValues("key", 100)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should call generic function with two type parameters', async () => {
        const result = await agenticPro<[string, number]>`Call ${pairValues} with "key" and 100.`();
        expect(result).toEqual(['key', 100]);
    });

    /**mock
    Map array with mapper function.

    ```python
    try:
        return mapArray(arr, doubler)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should call generic function with mapper', async () => {
        const arr = [1, 2, 3];
        const doubler = (n: number) => n * 2;
        const result = await agenticPro<number[]>`Call ${mapArray} with ${arr} and ${doubler}.`();
        expect(result).toEqual([2, 4, 6]);
    });
});

class GenericBox<T> {
    private value: T;

    constructor(value: T) {
        this.value = value;
    }

    getValue(): T {
        return this.value;
    }

    setValue(value: T): void {
        this.value = value;
    }
}

describe('Generic Box Tests', () => {
    /**mock
    Generic box with value.

    ```python
    try:
        return box.getValue()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should create generic class with string', async () => {
        const box = new GenericBox<string>('content');
        const result = await agenticPro<string>`Call getValue on ${box}.`();
        expect(result).toBe('content');
    });

    /**mock
    Setting value on generic box.

    ```python
    try:
        box.setValue("updated")
        return None
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should set value on generic class', async () => {
        const box = new GenericBox<string>('initial');
        await agenticPro<void>`Call setValue on ${box} with "updated".`();
        expect(box.getValue()).toBe('updated');
    });
});

class GenericPair<K, V> {
    constructor(
        public key: K,
        public value: V
    ) {}

    getKey(): K {
        return this.key;
    }

    getValue(): V {
        return this.value;
    }

    swap(): GenericPair<V, K> {
        return new GenericPair(this.value, this.key);
    }
}

describe('Generic Pair Tests', () => {
    /**mock
    Getting key from generic pair.

    ```python
    try:
        return pair.getKey()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should create generic pair class', async () => {
        const pair = new GenericPair<string, number>('age', 25);
        const result = await agenticPro<string>`Call getKey on ${pair}.`();
        expect(result).toBe('age');
    });

    /**mock
    Getting value from generic pair.

    ```python
    try:
        return pair.getValue()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should get value from generic pair', async () => {
        const pair = new GenericPair<string, number>('count', 10);
        const result = await agenticPro<number>`Call getValue on ${pair}.`();
        expect(result).toBe(10);
    });

    /**mock
    Swapping generic pair.

    ```python
    try:
        return pair.swap()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should swap generic pair', async () => {
        const pair = new GenericPair<string, number>('test', 5);
        const result = await agenticPro<GenericPair<number, string>>`Call swap on ${pair}.`();
        expect(result.getKey()).toBe(5);
        expect(result.getValue()).toBe('test');
    });
});

interface Container<T> {
    item: T;
    getItem(): T;
}

class StringContainer implements Container<string> {
    constructor(public item: string) {}

    getItem(): string {
        return this.item;
    }
}

describe('Generic Interface Tests', () => {
    /**mock
    Generic interface implementation.

    ```python
    return container.getItem()
    ```
    */
    it('should access property from interface implementation with generic', async () => {
        const container = new StringContainer('data');
        const result = await agenticPro<string>`Call getItem on ${container}.`();
        expect(result).toBe('data');
    });
});

function mergeObjects<T extends object, U extends object>(obj1: T, obj2: U): T & U {
    return { ...obj1, ...obj2 };
}

class ConstrainedGeneric<T extends { length: number }> {
    constructor(private value: T) {}

    getLength(): number {
        return this.value.length;
    }

    getValue(): T {
        return this.value;
    }
}

describe('Constrained Generics Tests', () => {
    /**mock
    Merging objects with constraint.

    ```python
    try:
        return mergeObjects(obj1, obj2)
    except Exception:
        raise AgentError("test failed")
    raise AgentError("return type failed")
    ```
    */
    it.fails('should call generic function with object constraint', async () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { c: 3, d: 4 };
        const result = await agenticPro<{
            a: number;
            b: number;
            c: number;
            d: number;
        }>`Call ${mergeObjects} with ${obj1} and ${obj2}.`();
        expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });

    /**mock
    Constrained generic with length property.

    ```python
    return obj.getLength()
    ```
    */
    it('should use constrained generic with string', async () => {
        const obj = new ConstrainedGeneric('hello');
        const result = await agenticPro<number>`Call getLength on ${obj}.`();
        expect(result).toBe(5);
    });

    /**mock
    Getting value from constrained generic.

    ```python
    return obj.getValue()
    ```
    */
    it('should get value from constrained generic', async () => {
        const obj = new ConstrainedGeneric([10, 20, 30]);
        const result = await agenticPro<number[]>`Call getValue on ${obj}.`();
        expect(result).toEqual([10, 20, 30]);
    });
});
