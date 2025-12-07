import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

function futureFn(): Promise<number> {
    return new Promise((resolve, _) => {
        setTimeout(() => {
            resolve(5);
        }, 100);
    });
}

function futureThrowingFn(): Promise<number> {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('JS Thrown Error'));
        }, 100);
    });
}

async function asyncFutureFn(): Promise<number> {
    const result = await futureFn();
    return result;
}

async function asyncFutureThrowingFn(): Promise<number> {
    const result = await futureThrowingFn();
    return result;
}

async function asyncErrorFn(): Promise<Error> {
    return new Promise((resolve, _) => {
        setTimeout(() => {
            resolve(new Error('JS Error to be consumed'));
        }, 100);
    });
}

describe('Future tests', () => {
    /**mock
    ```python
    return await futureFn()
    ```
    */
    it('should return a number', async () => {
        const result = await agenticPro<number>`Return a number from ${futureFn}.`();
        expect(result).toBe(5);
    });

    /**mock
    ```python
    try:
        return await futureThrowingFn()
    except Exception as e:
        raise AgentError("Python Thrown Error")
    ```
    */

    it('should throw an error 2', async () => {
        try {
            await agenticPro<number>`Return a number from ${futureThrowingFn}.`();
        } catch (error) {
            expect((error as Error).message).toBe('Python Thrown Error');
        }
    });

    /**mock
    ```python
    return await asyncFutureFn()
    ```
    */
    it('should return a number', async () => {
        const result = await agenticPro<number>`Return a number from ${asyncFutureFn}.`();
        expect(result).toBe(5);
    });

    /**mock
    ```python
    try:
        return await asyncFutureThrowingFn()
    except Exception as e:
        raise AgentError("Python Thrown Error")
    ```
    */

    it('should throw an error 2', async () => {
        try {
            await agenticPro<number>`Return a number from ${asyncFutureThrowingFn}.`();
        } catch (error) {
            expect((error as Error).message).toBe('Python Thrown Error');
        }
    });

    /**mock
    ```python
    exception = await asyncErrorFn()
    return str(exception)
    ```
    */
    it('should return an error', async () => {
        const result = await agenticPro<string>`Return an error from ${asyncErrorFn}.`();
        expect(result).toContain('JS Error to be consumed');
    });
});
