import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

function destructureObject(obj: { name: string; age: number }): string {
    const { name, age } = obj;
    return `${name} is ${age}`;
}

function destructureWithRename(obj: { firstName: string; lastName: string }): string {
    const { firstName: first, lastName: last } = obj;
    return `${first} ${last}`;
}

describe('Object Destructuring Tests', () => {
    /**mock
    Destructuring object properties.

    ```python
    return destructureObject(obj)
    ```
    */
    it('should destructure object properties', async () => {
        const obj = { name: 'Alice', age: 30 };
        const result = await agenticPro<string>`Call ${destructureObject} with ${obj}.`();
        expect(result).toBe('Alice is 30');
    });

    /**mock
    Destructuring with rename.

    ```python
    obj.firstName = "John"
    obj.lastName = "Dory"
    return destructureWithRename(obj)
    ```
    */
    it('should destructure with property renaming', async () => {
        const obj = { firstName: 'John', lastName: 'Doe' };
        const result = await agenticPro<string>`Call ${destructureWithRename} with ${obj}.`();
        expect(result).toBe('John Dory');
    });
});

function destructureArray(arr: number[]): number {
    const [first, second, third] = arr;
    return first + second + third;
}

function arrayWithSkip(arr: number[]): [number, number] {
    const [first, , third] = arr;
    return [first, third];
}

describe('Array Destructuring Tests', () => {
    /**mock
    Destructuring array elements.

    ```python
    try:
        return destructureArray(arr)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure array elements', async () => {
        const arr = [10, 20, 30];
        const result = await agenticPro<number>`Call ${destructureArray} with ${arr}.`();
        expect(result).toBe(60);
    });

    /**mock
    Array destructuring with skip.

    ```python
    try:
        return arrayWithSkip(arr)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure array with skip', async () => {
        const arr = [1, 2, 3, 4];
        const result = await agenticPro<[number, number]>`Call ${arrayWithSkip} with ${arr}.`();
        expect(result).toEqual([1, 3]);
    });
});

function destructureWithRest(obj: { a: number; b: number; c: number; d: number }): number {
    const { a, b, ...rest } = obj;
    return a + b + rest.c + rest.d;
}

function arrayRestDestructure(arr: number[]): { first: number; rest: number[] } {
    const [first, ...rest] = arr;
    return { first, rest };
}

describe('Rest Destructuring Tests', () => {
    /**mock
    Destructuring with rest operator.

    ```python
    try:
        return destructureWithRest(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure with rest operator', async () => {
        const obj = { a: 1, b: 2, c: 3, d: 4 };
        const result = await agenticPro<number>`Call ${destructureWithRest} with ${obj}.`();
        expect(result).toBe(10);
    });

    /**mock
    Array destructuring with rest.

    ```python
    return arrayRestDestructure(arr)
    ```
    */
    it('should destructure array with rest', async () => {
        const arr = [1, 2, 3, 4, 5];
        const result = await agenticPro<{ first: number; rest: number[] }>`Call ${arrayRestDestructure} with ${arr}.`();
        expect(result).toEqual({ first: 1, rest: [2, 3, 4, 5] });
    });
});

function destructureNested(obj: { user: { name: string; profile: { age: number } } }): string {
    const {
        user: {
            name,
            profile: { age },
        },
    } = obj;
    return `${name}, ${age}`;
}

function multiLevelDestructure(obj: { data: { items: { value: number }[] } }): number {
    const {
        data: {
            items: [{ value }],
        },
    } = obj;
    return value;
}

describe('Nested Destructuring Tests', () => {
    /**mock
    Destructuring nested objects.

    ```python
    try:
        return destructureNested(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure nested objects', async () => {
        const obj = { user: { name: 'Bob', profile: { age: 25 } } };
        const result = await agenticPro<string>`Call ${destructureNested} with ${obj}.`();
        expect(result).toBe('Bob, 25');
    });

    /**mock
    Multi-level destructuring.

    ```python
    try:
        return multiLevelDestructure(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure multiple levels', async () => {
        const obj = { data: { items: [{ value: 99 }] } };
        const result = await agenticPro<number>`Call ${multiLevelDestructure} with ${obj}.`();
        expect(result).toBe(99);
    });
});

function destructureWithDefaults(obj: { required: string; optional?: number }): string {
    const { required, optional = 10 } = obj;
    return `${required}-${optional}`;
}

describe('Destructuring with Defaults Tests', () => {
    /**mock
    Destructuring with default when present.

    ```python
    try:
        return destructureWithDefaults(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure with default values when property present', async () => {
        const obj = { required: 'test', optional: 20 };
        const result = await agenticPro<string>`Call ${destructureWithDefaults} with ${obj}.`();
        expect(result).toBe('test-20');
    });

    /**mock
    Using default value when missing.

    ```python
    try:
        return destructureWithDefaults(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should use default value when property missing', async () => {
        const obj = { required: 'test' };
        const result = await agenticPro<string>`Call ${destructureWithDefaults} with ${obj}.`();
        expect(result).toBe('test-10');
    });
});

class DestructuringUser {
    getFullName(obj: { firstName: string; lastName: string }): string {
        const { firstName, lastName } = obj;
        return `${firstName} ${lastName}`;
    }

    processArray(arr: [string, number, boolean]): { text: string; num: number; flag: boolean } {
        const [text, num, flag] = arr;
        return { text, num, flag };
    }

    extractNumbers(data: { values: number[] }): number {
        const {
            values: [first, second],
        } = data;
        return first + second;
    }

    swapPair(pair: [number, number]): [number, number] {
        const [a, b] = pair;
        return [b, a];
    }
}

describe('Class Destructuring Tests', () => {
    /**mock
    Destructuring in class method.

    ```python
    try:
        return user.getFullName(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure in class method', async () => {
        const user = new DestructuringUser();
        const obj = { firstName: 'Jane', lastName: 'Smith' };
        const result = await agenticPro<string>`Call getFullName on ${user} with ${obj}.`();
        expect(result).toBe('Jane Smith');
    });

    /**mock
    Destructuring tuple in class.

    ```python
    try:
        return user.processArray(tuple)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure tuple in class method', async () => {
        const user = new DestructuringUser();
        const tuple: [string, number, boolean] = ['test', 42, true];
        const result = await agenticPro<{
            text: string;
            num: number;
            flag: boolean;
        }>`Call processArray on ${user} with ${tuple}.`();
        expect(result).toEqual({ text: 'test', num: 42, flag: true });
    });

    /**mock
    Destructuring nested array.

    ```python
    try:
        return user.extractNumbers(data)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure nested array in object', async () => {
        const user = new DestructuringUser();
        const data = { values: [10, 20, 30] };
        const result = await agenticPro<number>`Call extractNumbers on ${user} with ${data}.`();
        expect(result).toBe(30);
    });

    /**mock
    Destructuring and swapping.

    ```python
    try:
        return user.swapPair(pair)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure and swap', async () => {
        const user = new DestructuringUser();
        const pair: [number, number] = [5, 10];
        const result = await agenticPro<[number, number]>`Call swapPair on ${user} with ${pair}.`();
        expect(result).toEqual([10, 5]);
    });
});

function parametersDestructure({ name, value }: { name: string; value: number }): string {
    return `${name}: ${value}`;
}

describe('Parameter Destructuring Tests', () => {
    /**mock
    Destructuring function parameters.

    ```python
    try:
        return parametersDestructure(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should destructure function parameters', async () => {
        const obj = { name: 'param', value: 100 };
        const result = await agenticPro<string>`Call ${parametersDestructure} with ${obj}.`();
        expect(result).toBe('param: 100');
    });
});
