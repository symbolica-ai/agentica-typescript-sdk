import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

async function simpleAsync(): Promise<string> {
    return 'async-result';
}

async function _asyncWithDelay(value: number): Promise<number> {
    return value * 2;
}

async function asyncReturningObject(): Promise<{ status: string; code: number }> {
    return { status: 'success', code: 200 };
}

describe('Basic Async Functions Tests', () => {
    /**mock
    Calling simple async function.

    ```python
    try:
        return await simpleAsync()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call simple async function', async () => {
        const result = await agenticPro<string>`Call ${simpleAsync} and return the result.`();
        expect(result).toBe('async-result');
    });

    /**mock
    Async function returning object.

    ```python
    try:
        return await asyncReturningObject()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call async function returning object', async () => {
        const result = await agenticPro<{ status: string; code: number }>`Call ${asyncReturningObject}.`();
        expect(result).toEqual({ status: 'success', code: 200 });
    });
});

class AsyncMethods {
    private data: string = 'initial';

    async fetchData(): Promise<string> {
        return this.data;
    }

    async updateData(newData: string): Promise<void> {
        this.data = newData;
    }

    async compute(a: number, b: number): Promise<number> {
        return a + b;
    }

    async chainAsync(value: string): Promise<string> {
        return `processed-${value}`;
    }
}

describe('Async Methods Tests', () => {
    /**mock
    Calling async method.

    ```python
    try:
        return await obj.fetchData()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call async method on class', async () => {
        const obj = new AsyncMethods();
        const result = await agenticPro<string>`Call fetchData on ${obj}.`();
        expect(result).toBe('initial');
    });

    /**mock
    Calling async void method.

    ```python
    try:
        await obj.updateData("updated")
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call async void method', async () => {
        const obj = new AsyncMethods();
        await agenticPro<void>`Call updateData on ${obj} with "updated".`();
        const data = await obj.fetchData();
        expect(data).toBe('updated');
    });

    /**mock
    Async method with multiple params.

    ```python
    try:
        return await obj.compute(15, 27)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call async method with multiple parameters', async () => {
        const obj = new AsyncMethods();
        const result = await agenticPro<number>`Call compute on ${obj} with 15 and 27.`();
        expect(result).toBe(42);
    });

    /**mock
    Using Promise.resolve.

    ```python
    try:
        return await createPromise(7)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should handle async method chaining with intermediate values', async () => {
        const obj = new AsyncMethods();
        const result = await agenticPro<string>`Call chainAsync on ${obj} with "test".`();
        expect(result).toBe('processed-test');
    });

    /**mock
    Multiple awaits.

    ```python
    try:
        return await asyncWithMultipleAwaits(5, 4)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should call multiple async operations in sequence', async () => {
        const obj = new AsyncMethods();
        await agenticPro<void>`Call updateData on ${obj} with "first", then call it again with "second".`();
        const data = await obj.fetchData();
        expect(data).toBe('second');
    });
});

function createPromise(value: number): Promise<number> {
    return Promise.resolve(value * 3);
}

async function asyncWithMultipleAwaits(x: number, y: number): Promise<number> {
    const first = await Promise.resolve(x * 2);
    const second = await Promise.resolve(y * 3);
    return first + second;
}

async function asyncReturningArray(): Promise<number[]> {
    return [1, 2, 3, 4, 5];
}

describe('Advanced Async Tests', () => {
    /**mock
    Async returning array.

    ```python
    try:
        return await asyncReturningArray()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should work with Promise.resolve', async () => {
        const result = await agenticPro<number>`Call ${createPromise} with 7.`();
        expect(result).toBe(21);
    });

    /**mock
    Chaining async calls.

    ```python
    try:
        step_one_result = await obj.stepOne()
        step_two_result = await obj.stepTwo(step_one_result)
        return await obj.stepThree(step_two_result)
        return result
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should handle multiple awaits', async () => {
        const result = await agenticPro<number>`Call ${asyncWithMultipleAwaits} with 5 and 4.`();
        expect(result).toBe(22);
    });

    /**mock
    Async method chaining.

    ```python
    try:
        return await obj.chainAsync("test")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should call async function returning array', async () => {
        const result = await agenticPro<number[]>`Call ${asyncReturningArray}.`();
        expect(result).toEqual([1, 2, 3, 4, 5]);
    });
});

class AsyncChaining {
    async stepOne(): Promise<number> {
        return 10;
    }

    async stepTwo(value: number): Promise<number> {
        return value + 5;
    }

    async stepThree(value: number): Promise<string> {
        return `result-${value}`;
    }
}

describe('Async Chaining Tests', () => {
    /**mock
    Multiple async operations in sequence.

    ```python
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(obj.updateData("first"))
            tg.create_task(obj.updateData("second"))
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should chain async method calls', async () => {
        const obj = new AsyncChaining();
        const result =
            await agenticPro<string>`Call stepOne on ${obj}, pass result to stepTwo, then pass to stepThree.`();
        expect(result).toBe('result-15');
    });
});
