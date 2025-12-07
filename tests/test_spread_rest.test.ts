import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

function sumAll(...numbers: number[]): number {
    return numbers.reduce((sum, n) => sum + n, 0);
}

function _concatenateStrings(...strings: string[]): string {
    return strings.join('-');
}

function firstAndRest(first: number, ...rest: number[]): { first: number; rest: number[] } {
    return { first, rest };
}

describe('Rest Parameters Tests', () => {
    /**mock
    Using rest parameters.

    ```python
    return sumAll(1, 2, 3, 4, 5)
    ```
    */
    it('should sum all numbers with rest parameters', async () => {
        const result = await agenticPro<number>`Call ${sumAll} with 1, 2, 3, 4, 5.`();
        expect(result).toBe(15);
    });

    /**mock
    Let me return the stub for sumAll.

    ```python
    return format_definition(sumAll)
    ```
    */
    it('should return the stub for sumAll', async () => {
        const result =
            await agenticPro<string>`Call format_definition on ${sumAll} and return the result as a string.`();
        // TODO: we need to strip off the list[] for Python!
        expect(result).toBe('def sumAll(*numbers: list[int]) -> int: ...');
    });

    /**mock
    Separating first from rest.

    ```python
    return firstAndRest(10, 20, 30, 40)
    ```
    */
    it('should separate first from rest', async () => {
        const result = await agenticPro<{ first: number; rest: number[] }>`Call ${firstAndRest} with 10, 20, 30, 40.`();
        expect(result).toEqual({ first: 10, rest: [20, 30, 40] });
    });
});

function mergeArrays(arr1: number[], arr2: number[]): number[] {
    return [...arr1, ...arr2];
}

function cloneArray(arr: number[]): number[] {
    return [...arr];
}

function spreadWithLiterals(...values: number[]): number[] {
    return [0, ...values, 100];
}

describe('Array Spread Tests', () => {
    /**mock
    Merging arrays with spread.

    ```python
    try:
        return mergeArrays(arr1, arr2)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should merge two arrays with spread', async () => {
        const arr1 = [1, 2, 3];
        const arr2 = [4, 5, 6];
        const result = await agenticPro<number[]>`Call ${mergeArrays} with ${arr1} and ${arr2}.`();
        expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    /**mock
    Cloning array with spread.

    ```python
    try:
        return cloneArray(arr)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should clone array with spread', async () => {
        const arr = [10, 20, 30];
        const result = await agenticPro<number[]>`Call ${cloneArray} with ${arr}.`();
        expect(result).toEqual([10, 20, 30]);
    });

    /**mock
    Spread with literal values.

    ```python
    try:
        return spreadWithLiterals(1, 2, 3)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should spread with literal values', async () => {
        const result = await agenticPro<number[]>`Call ${spreadWithLiterals} with 1, 2, 3.`();
        expect(result).toEqual([0, 1, 2, 3, 100]);
    });
});

function mergeObjects(obj1: { a: number }, obj2: { b: number }): { a: number; b: number } {
    return { ...obj1, ...obj2 };
}

function cloneObject(obj: { name: string; value: number }): { name: string; value: number } {
    return { ...obj };
}

function overrideProperties(base: { a: number; b: number }, override: { b: number }): { a: number; b: number } {
    return { ...base, ...override };
}

function objectSpreadWithLiterals(obj: { b: number; c: number }): { a: number; b: number; c: number; d: number } {
    return { a: 1, ...obj, d: 4 };
}

describe('Object Spread Tests', () => {
    /**mock
    Merging objects with spread.

    ```python
    try:
        return mergeObjects(obj1, obj2)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should merge objects with spread', async () => {
        const obj1 = { a: 1 };
        const obj2 = { b: 2 };
        const result = await agenticPro<{ a: number; b: number }>`Call ${mergeObjects} with ${obj1} and ${obj2}.`();
        expect(result).toEqual({ a: 1, b: 2 });
    });

    /**mock
    Cloning object with spread.

    ```python
    try:
        return cloneObject(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should clone object with spread', async () => {
        const obj = { name: 'test', value: 42 };
        const result = await agenticPro<{ name: string; value: number }>`Call ${cloneObject} with ${obj}.`();
        expect(result).toEqual({ name: 'test', value: 42 });
    });

    /**mock
    Overriding properties with spread.

    ```python
    try:
        return overrideProperties(base, override)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should override properties with spread', async () => {
        const base = { a: 1, b: 2 };
        const override = { b: 20 };
        const result = await agenticPro<{
            a: number;
            b: number;
        }>`Call ${overrideProperties} with ${base} and ${override}.`();
        expect(result).toEqual({ a: 1, b: 20 });
    });

    /**mock
    Object spread with literals.

    ```python
    try:
        return objectSpreadWithLiterals(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should object spread with literals', async () => {
        const obj = { b: 2, c: 3 };
        const result = await agenticPro<{
            a: number;
            b: number;
            c: number;
            d: number;
        }>`Call ${objectSpreadWithLiterals} with ${obj}.`();
        expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });
});

class SpreadRestUser {
    combineArrays(...arrays: number[][]): number[] {
        return arrays.flat();
    }

    addPrefix(prefix: string, ...words: string[]): string[] {
        return words.map((w) => `${prefix}${w}`);
    }

    extendObject(base: { x: number }, extension: { y: number }): { x: number; y: number } {
        return { ...base, ...extension };
    }

    spreadIntoFunction(arr: number[]): number {
        return Math.max(...arr);
    }
}

describe('Spread and Rest in Class Tests', () => {
    /**mock
    Combining arrays in class.

    ```python
    try:
        return user.combineArrays([1, 2], [3, 4], [5, 6])
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should combine arrays in class method', async () => {
        const user = new SpreadRestUser();
        const result = await agenticPro<number[]>`Call combineArrays on ${user} with [1, 2], [3, 4], [5, 6].`();
        expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    /**mock
    Adding prefix with rest.

    ```python
    try:
        return user.addPrefix("pre-", "fix", "test", "word")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should add prefix with rest parameters', async () => {
        const user = new SpreadRestUser();
        const result = await agenticPro<string[]>`Call addPrefix on ${user} with "pre-", "fix", "test", "word".`();
        expect(result).toEqual(['pre-fix', 'pre-test', 'pre-word']);
    });

    /**mock
    Extending object in class.

    ```python
    try:
        return user.extendObject(base, extension)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should extend object in class method', async () => {
        const user = new SpreadRestUser();
        const base = { x: 10 };
        const extension = { y: 20 };
        const result = await agenticPro<{
            x: number;
            y: number;
        }>`Call extendObject on ${user} with ${base} and ${extension}.`();
        expect(result).toEqual({ x: 10, y: 20 });
    });

    /**mock
    Spreading array into function.

    ```python
    try:
        return user.spreadIntoFunction(arr)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should spread array into function call', async () => {
        const user = new SpreadRestUser();
        const arr = [5, 15, 10, 3, 20];
        const result = await agenticPro<number>`Call user.spreadIntoFunction on ${user} with ${arr}.`();
        expect(result).toBe(20);
    });
});

function insertInMiddle(arr: number[], ...toInsert: number[]): number[] {
    return [...arr.slice(0, 2), ...toInsert, ...arr.slice(2)];
}

function nestedSpread(arr1: number[], arr2: number[]): number[][] {
    return [[...arr1], [...arr2]];
}

describe('Advanced Spread Operations Tests', () => {
    /**mock
    Inserting in middle with spread.

    ```python
    try:
        return insertInMiddle(arr, 3, 4, 5, 6)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should insert elements in middle with spread', async () => {
        const arr = [1, 2, 7, 8];
        const result = await agenticPro<number[]>`Call ${insertInMiddle} with ${arr}, 3, 4, 5, 6.`();
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    /**mock
    Nested spread arrays.

    ```python
    try:
        return nestedSpread(arr1, arr2)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should nested spread arrays', async () => {
        const arr1 = [1, 2];
        const arr2 = [3, 4];
        const result = await agenticPro<number[][]>`Call ${nestedSpread} with ${arr1} and ${arr2}.`();
        expect(result).toEqual([
            [1, 2],
            [3, 4],
        ]);
    });
});
