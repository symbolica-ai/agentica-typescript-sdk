import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class BasicMethods {
    value: number = 0;

    increment(): number {
        this.value += 1;
        return this.value;
    }

    add(amount: number): number {
        this.value += amount;
        return this.value;
    }

    addMultiple(a: number, b: number, c: number): number {
        this.value += a + b + c;
        return this.value;
    }
}

describe('Basic Methods Tests', () => {
    /**mock
    Calling increment method.

    ```python
    return obj.increment()
    ```
    */
    it('should call method with no parameters', async () => {
        const obj = new BasicMethods();
        const result = await agenticPro<number>`Call the increment method on ${obj} and return the result.`();
        expect(result).toBe(1);
    });

    /**mock
    Calling add with parameter.

    ```python
    return obj.add(5)
    ```
    */
    it('should call method with single parameter', async () => {
        const obj = new BasicMethods();
        const result = await agenticPro<number>`Call the add method on ${obj} with argument 5.`();
        expect(result).toBe(5);
    });

    /**mock
    Calling method with multiple parameters.

    ```python
    return obj.addMultiple(1, 2, 3)
    ```
    */
    it('should call method with multiple parameters', async () => {
        const obj = new BasicMethods();
        const result = await agenticPro<number>`Call addMultiple on ${obj} with arguments 1, 2, 3.`();
        expect(result).toBe(6);
    });
});

class StaticMethods {
    static multiply(a: number, b: number): number {
        return a * b;
    }
}

describe('Static Methods Tests', () => {
    /**mock
    Calling static method with parameters.

    ```python
    try:
        return StaticMethods.multiply(7, 8)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should call static method with parameters', async () => {
        const result =
            await agenticPro<number>`Call the static multiply method on ${StaticMethods} with arguments 7 and 8.`();
        expect(result).toBe(56);
    });
});

class AsyncMethods {
    async fetchData(id: number): Promise<string> {
        return `data-${id}`;
    }
}

describe('Async Methods Tests', () => {
    /**mock
    Calling async method.

    ```python
    try:
        return asyncio.run(obj.fetchData(123))
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call async method', async () => {
        const obj = new AsyncMethods();
        const result = await agenticPro<string>`Call fetchData on ${obj} with id 123.`();
        expect(result).toBe('data-123');
    });
});

class MethodWithReturnTypes {
    getValue(): string {
        return 'test-value';
    }

    getNumber(): number {
        return 42;
    }

    getBoolean(): boolean {
        return true;
    }

    getNothing(): void {
        return;
    }
}

describe('Method Return Types Tests', () => {
    /**mock
    Getting number value.

    ```python
    try:
        return obj.getValue()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method returning string', async () => {
        const obj = new MethodWithReturnTypes();
        const result = await agenticPro<string>`Call getValue on ${obj}.`();
        expect(result).toBe('test-value');
    });

    /**mock
    Getting boolean value.

    ```python
    try:
        return obj.getNumber()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method returning number', async () => {
        const obj = new MethodWithReturnTypes();
        const result = await agenticPro<number>`Call getNumber on ${obj}.`();
        expect(result).toBe(42);
    });

    /**mock
    Chaining method calls.

    ```python
    try:
        return obj.getBoolean()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method returning boolean', async () => {
        const obj = new MethodWithReturnTypes();
        const result = await agenticPro<boolean>`Call getBoolean on ${obj}.`();
        expect(result).toBe(true);
    });
});

class ChainableMethods {
    private data: string = '';

    append(text: string): ChainableMethods {
        this.data += text;
        return this;
    }

    getValue(): string {
        return this.data;
    }
}

describe('Chainable Methods Tests', () => {
    /**mock
    Calling increment three times.

    ```python
    try:
        return obj.append("hello").append(" world").getValue()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should chain method calls', async () => {
        const obj = new ChainableMethods();
        const result =
            await agenticPro<string>`Call append on ${obj} with "hello", then append " world", then call getValue.`();
        expect(result).toBe('hello world');
    });
});
