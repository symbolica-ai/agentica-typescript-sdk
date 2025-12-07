import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

function simpleFunction(): string {
    return 'simple-result';
}

function functionWithParameters(a: number, b: number): number {
    return a + b;
}

describe('Basic Functions Tests', () => {
    /**mock
    Calling simple function.

    ```python
    return simpleFunction()
    ```
    */
    it('should call simple function with no parameters', async () => {
        const result = await agenticPro<string>`Call ${simpleFunction} and return the result.`();
        expect(result).toBe('simple-result');
    });

    /**mock
    Calling function with parameters.

    ```python
    return functionWithParameters(10, 20)
    ```
    */
    it('should call function with parameters', async () => {
        const result = await agenticPro<number>`Call ${functionWithParameters} with arguments 10 and 20.`();
        expect(result).toBe(30);
    });
});

function functionWithDefaultParams(name: string, greeting: string = 'Hello'): string {
    return `${greeting}, ${name}!`;
}

function functionWithOptionalParam(required: string, optional?: string): string {
    return optional ? `${required}-${optional}` : required;
}

describe('Optional and Default Parameters Tests', () => {
    /**mock
    Calling with default parameter.

    ```python
    return functionWithDefaultParams("Alice")
    ```
    */
    it('should call function with default parameter not provided', async () => {
        const result = await agenticPro<string>`Call ${functionWithDefaultParams} with just "Alice".`();
        expect(result).toBe('Hello, Alice!');
    });

    /**mock
    Overriding default parameter.

    ```python
    return functionWithDefaultParams("Bob", "Hi")
    ```
    */
    it('should call function with default parameter overridden', async () => {
        const result = await agenticPro<string>`Call ${functionWithDefaultParams} with "Bob" and "Hi".`();
        expect(result).toBe('Hi, Bob!');
    });

    /**mock
    Optional parameter not provided.

    ```python
    return functionWithOptionalParam("required")
    ```
    */
    it('should call function with optional parameter not provided', async () => {
        const result = await agenticPro<string>`Call ${functionWithOptionalParam} with just "required".`();
        expect(result).toBe('required');
    });

    /**mock
    Optional parameter provided.

    ```python
    return functionWithOptionalParam("first", "second")
    ```
    */
    it('should call function with optional parameter provided', async () => {
        const result = await agenticPro<string>`Call ${functionWithOptionalParam} with "first" and "second".`();
        expect(result).toBe('first-second');
    });
});

function functionReturningObject(id: number): { id: number; name: string } {
    return { id, name: `item-${id}` };
}

describe.skip('Functions Returning Objects Tests', () => {
    /**DISABLED mock
    Getting object result.

    ```python
    try:
        return functionReturningObject(42)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call function returning object', async () => {
        const result = await agenticPro<{ id: number; name: string }>`Call ${functionReturningObject} with 42.`();
        expect(result).toEqual({ id: 42, name: 'item-42' });
    });
});

const arrowFunction = (x: number): number => x * 2;

const arrowWithMultipleParams = (a: number, b: number, c: number): number => a + b + c;

const arrowReturningObject = (value: string): { data: string } => ({ data: value });

describe('Arrow Functions Tests', () => {
    /**mock:
    Calling arrow function.

    ```python
    try:
        return arrowFunction(15)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call arrow function', async () => {
        const result = await agenticPro<number>`Call ${arrowFunction} with 15.`();
        expect(result).toBe(30);
    });

    /**mock:
    Arrow with multiple params.

    ```python
    try:
        return arrowWithMultipleParams(5, 10, 15)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call arrow function with multiple parameters', async () => {
        const result = await agenticPro<number>`Call ${arrowWithMultipleParams} with 5, 10, 15.`();
        expect(result).toBe(30);
    });

    /**mock:
    Arrow returning object.

    ```python
    try:
        return arrowReturningObject("test")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call arrow function returning object', async () => {
        const result = await agenticPro<{ data: string }>`Call ${arrowReturningObject} with "test".`();
        expect(result).toEqual({ data: 'test' });
    });
});

async function asyncFunction(delay: number): Promise<string> {
    return `delayed-${delay}`;
}

describe('Async Functions Tests', () => {
    /**mock
    Calling async function.

    ```python
    try:
        return asyncio.run(asyncFunction(100))
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call async function', async () => {
        const result = await agenticPro<string>`Call ${asyncFunction} with 100.`();
        expect(result).toBe('delayed-100');
    });
});

function higherOrderFunction(callback: (n: number) => number, value: number): number {
    return callback(value);
}

function functionWithRestParams(...numbers: number[]): number {
    return numbers.reduce((sum, n) => sum + n, 0);
}

describe('Advanced Functions Tests', () => {
    /**mock
    Higher-order function with callback.

    ```python
    try:
        return higherOrderFunction(double, 21)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call higher-order function with callback', async () => {
        const double = (n: number) => n * 2;
        const result = await agenticPro<number>`Call ${higherOrderFunction} with ${double} and 21.`();
        expect(result).toBe(42);
    });

    /**mock
    Rest parameters.

    ```python
    try:
        return functionWithRestParams(1, 2, 3, 4, 5)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call function with rest parameters', async () => {
        const result = await agenticPro<number>`Call ${functionWithRestParams} with 1, 2, 3, 4, 5.`();
        expect(result).toBe(15);
    });
});
