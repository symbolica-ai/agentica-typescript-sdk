import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

function createTuple(): [string, number] {
    return ['test', 42];
}

function processTuple(tuple: [string, number]): string {
    return `${tuple[0]}-${tuple[1]}`;
}

function createTriple(a: string, b: number, c: boolean): [string, number, boolean] {
    return [a, b, c];
}

describe('Basic Tuple Tests', () => {
    /**mock
    Creating and returning tuple.

    ```python
    try:
        return createTuple()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should create and return tuple', async () => {
        const result = await agenticPro<[string, number]>`Call ${createTuple}.`();
        expect(result).toEqual(['test', 42]);
    });

    /**mock
    Accessing first element of tuple.

    ```python
    try:
        return tuple[0]
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access first element of tuple', async () => {
        const tuple: [string, number] = ['hello', 100];
        const result = await agenticPro<string>`Return the first element of ${tuple}.`();
        expect(result).toBe('hello');
    });

    /**mock
    Accessing second element of tuple.

    ```python
    try:
        return tuple[1]
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access second element of tuple', async () => {
        const tuple: [string, number] = ['world', 200];
        const result = await agenticPro<number>`Return the second element of ${tuple}.`();
        expect(result).toBe(200);
    });

    /**mock
    Passing tuple to function.

    ```python
    try:
        return processTuple(tuple)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should pass tuple to function', async () => {
        const tuple: [string, number] = ['value', 5];
        const result = await agenticPro<string>`Call ${processTuple} with ${tuple}.`();
        expect(result).toBe('value-5');
    });

    /**mock
    Creating three-element tuple.

    ```python
    try:
        return createTriple("test", 10, True)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should create three-element tuple', async () => {
        const result = await agenticPro<[string, number, boolean]>`Call ${createTriple} with "test", 10, true.`();
        expect(result).toEqual(['test', 10, true]);
    });
});

class TupleContainer {
    pair: [string, number];
    triple: [number, number, number];

    constructor() {
        this.pair = ['initial', 0];
        this.triple = [1, 2, 3];
    }

    getPair(): [string, number] {
        return this.pair;
    }

    setPair(pair: [string, number]): void {
        this.pair = pair;
    }

    getTriple(): [number, number, number] {
        return this.triple;
    }

    getFirstFromPair(): string {
        return this.pair[0];
    }

    getSecondFromPair(): number {
        return this.pair[1];
    }
}

describe('Tuple Container Tests', () => {
    /**mock
    Getting tuple from class.

    ```python
    try:
        return obj.getPair()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access tuple property from class', async () => {
        const obj = new TupleContainer();
        const result = await agenticPro<[string, number]>`Call getPair on ${obj}.`();
        expect(result).toEqual(['initial', 0]);
    });

    /**mock
    Getting element from tuple in class.

    ```python
    try:
        return obj.getFirstFromPair()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access specific element from tuple in class', async () => {
        const obj = new TupleContainer();
        const result = await agenticPro<string>`Call getFirstFromPair on ${obj}.`();
        expect(result).toBe('initial');
    });

    /**mock
    Setting tuple property.

    ```python
    try:
        obj.setPair(["updated", 99])
        return None
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should set tuple property', async () => {
        const obj = new TupleContainer();
        await agenticPro<void>`Call setPair on ${obj} with ["updated", 99].`();
        expect(obj.pair).toEqual(['updated', 99]);
    });

    /**mock
    Accessing triple by index.

    ```python
    try:
        return obj.triple[1]
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access tuple element by index directly', async () => {
        const obj = new TupleContainer();
        const result = await agenticPro<number>`Return the second element (index 1) from the triple of ${obj}.`();
        expect(result).toBe(2);
    });

    /**mock
    Modifying tuple element.

    ```python
    try:
        raise AgentError(ValueError("Tuple is immutable"))
        obj.pair[0] = "modified"
        return None
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it.fails('should modify tuple element', async () => {
        const obj = new TupleContainer();
        await agenticPro<void>`Set the first element of the pair in ${obj} to "modified".`();
        expect(obj.pair[0]).toBe('modified');
    });
});

function swapTuple(tuple: [string, number]): [number, string] {
    return [tuple[1], tuple[0]];
}

function tupleWithOptional(value: string, count?: number): [string, number | undefined] {
    return [value, count];
}

function tupleWithRest(first: string, ...rest: number[]): [string, ...number[]] {
    return [first, ...rest];
}

function extractFromTuple(tuple: [string, number, boolean]): { text: string; num: number; flag: boolean } {
    const [text, num, flag] = tuple;
    return { text, num, flag };
}

describe('Advanced Tuple Operations Tests', () => {
    /**mock
    Swapping tuple elements.

    ```python
    try:
        return swapTuple(tuple)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should swap tuple elements', async () => {
        const tuple: [string, number] = ['text', 42];
        const result = await agenticPro<[number, string]>`Call ${swapTuple} with ${tuple}.`();
        expect(result).toEqual([42, 'text']);
    });

    /**mock
    Tuple with optional element present.

    ```python
    try:
        return tupleWithOptional("data", 5)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should handle tuple with optional element present', async () => {
        const result = await agenticPro<[string, number | undefined]>`Call ${tupleWithOptional} with "data" and 5.`();
        expect(result).toEqual(['data', 5]);
    });

    /**mock
    Tuple with optional element absent.

    ```python
    try:
        return tupleWithOptional("data")
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it.fails('should handle tuple with optional element absent', async () => {
        const result = await agenticPro<[string, number | undefined]>`Call ${tupleWithOptional} with just "data".`();
        expect(result).toEqual(['data', undefined]);
    });

    /**mock
    Tuple with rest elements.

    ```python
    try:
        return tupleWithRest("first", 1, 2, 3)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should handle tuple with rest elements', async () => {
        const result = await agenticPro<[string, ...number[]]>`Call ${tupleWithRest} with "first", 1, 2, 3.`();
        expect(result).toEqual(['first', 1, 2, 3]);
    });

    /**mock
    Destructuring tuple.

    ```python
    try:
        return extractFromTuple(tuple)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should destructure tuple in function', async () => {
        const tuple: [string, number, boolean] = ['value', 10, true];
        const result = await agenticPro<{
            text: string;
            num: number;
            flag: boolean;
        }>`Call ${extractFromTuple} with ${tuple}.`();
        expect(result).toEqual({ text: 'value', num: 10, flag: true });
    });
});
