import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

import ComingSoon from '@/coming-soon';

class ThisContext {
    value: number = 10;

    regularMethod(): number {
        return this.value;
    }

    arrowMethod = (): number => {
        return this.value;
    };

    methodReturningFunction(): () => number {
        return () => this.value;
    }

    methodReturningArrow = (): (() => number) => {
        return () => this.value;
    };
}

describe('This Context Tests', () => {
    /**mock
    Accessing this in regular method.

    ```python
    return obj.regularMethod()
    ```
    */
    it('should access this in regular method', async () => {
        const obj = new ThisContext();
        const result = await agenticPro<number>`Call regularMethod on ${obj}.`();
        expect(result).toBe(10);
    });

    /**mock
    Accessing this in arrow method.

    ```python
    print('a')
    try:
        print('b')
        return obj.arrowMethod()
        print('c')
    except Exception:
        print('d')
        raise AgentError("Test failed")
        print('e')
    print('f')
    ```
    */
    it('should access this in arrow method', async () => {
        const obj = new ThisContext();
        const result = await agenticPro<number>`Call arrowMethod on ${obj}.`();
        expect(result).toBe(10);
    });

    /**mock
    Maintaining this in returned function.

    ```python
    try:
        func = obj.methodReturningFunction()
        return func()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should maintain this in returned function', async () => {
        const obj = new ThisContext();
        const result =
            await agenticPro<number>`Call methodReturningFunction on ${obj}, then call the returned function.`();
        expect(result).toBe(10);
    });

    /**mock
    Maintaining this in returned arrow.

    ```python
    try:
        func = obj.methodReturningArrow()
        return func()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should maintain this in returned arrow from arrow', async () => {
        const obj = new ThisContext();
        const result =
            await agenticPro<number>`Call methodReturningArrow on ${obj}, then call the returned function.`();
        expect(result).toBe(10);
    });
});

class Counter {
    count: number = 0;

    increment(): void {
        this.count++;
    }

    getIncrementer(): () => void {
        return () => this.increment();
    }

    getCount(): number {
        return this.count;
    }
}

describe('Counter This Tests', () => {
    /**mock
    Modifying this context.

    ```python
    try:
        obj.increment()
        return obj.getCount()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should modify this context in method', async () => {
        const obj = new Counter();
        await agenticPro<number>`Call increment on ${obj}.`();
        expect(obj.getCount()).toBe(1);
    });

    /**mock
    Using this in returned function.

    ```python
    try:
        incrementer = obj.getIncrementer()
        incrementer()
        return obj.getCount()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should use this in returned function', async () => {
        const obj = new Counter();
        await agenticPro<number>`Call getIncrementer on ${obj} and call the returned function.`();
        expect(obj.getCount()).toBe(1);
    });

    /**mock
    Calling returned function multiple times.

    ```python
    try:
        incrementer = obj.getIncrementer()
        incrementer()
        incrementer()
        incrementer()
        return obj.getCount()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call returned function multiple times', async () => {
        const obj = new Counter();
        await agenticPro<number>`Get incrementer from ${obj} and call it 3 times.`();
        expect(obj.getCount()).toBe(3);
    });
});

class ChainableThis {
    private data: string = '';

    append(text: string): this {
        this.data += text;
        return this;
    }

    clear(): this {
        this.data = '';
        return this;
    }

    getValue(): string {
        return this.data;
    }
}

describe('Chainable This Tests', () => {
    /**mock
    Chaining methods returning this.

    ```python
    print('a')
    try:
        print('b')
        obj.append("hello").append(" world")
        print('c')
        return obj.getValue()
        print('d')
    except Exception:
        import traceback
        traceback.print_exc()
        print('e')
        raise AgentError("Test failed")
        print('f')
    print('g')
    ```
    */
    it('should chain methods returning this', async () => {
        const obj = new ChainableThis();
        await agenticPro<string>`Call append on ${obj} with "hello", then append " world".`();
        expect(obj.getValue()).toBe('hello world');
    });

    /**mock
    Using this in chained methods.

    ```python
    try:
        return obj.append("a").append("b").append("c").getValue()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should use this in chained methods', async () => {
        const obj = new ChainableThis();
        const result = await agenticPro<string>`Chain append "a", append "b", append "c", then getValue on ${obj}.`();
        expect(result).toBe('abc');
    });

    /**mock
    Clear and chain.

    ```python
    try:
        obj.clear().append("new")
        return obj.getValue()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should clear and chain', async () => {
        const obj = new ChainableThis();
        obj.append('initial');
        await agenticPro<string>`Call clear on ${obj}, then append "new".`();
        expect(obj.getValue()).toBe('new');
    });
});

class CallbackUser {
    value: string = 'initial';

    processWithCallback(callback: () => string): string {
        return callback();
    }

    getValueCallback = (): string => {
        return this.value;
    };

    useOwnCallback(): string {
        return this.processWithCallback(this.getValueCallback);
    }
}

describe('Callback This Tests', () => {
    /**mock
    Using arrow function as callback.

    ```python
    try:
        return obj.useOwnCallback()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should use arrow function as callback', async () => {
        const obj = new CallbackUser();
        const result = await agenticPro<string>`Call useOwnCallback on ${obj}.`();
        expect(result).toBe('initial');
    });

    /**mock
    Passing callback with correct this.

    ```python
    try:
        return obj.processWithCallback(obj.getValueCallback)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should pass callback with correct this', async () => {
        const obj = new CallbackUser();
        obj.value = 'modified';
        try {
            await agenticPro<string>`Call processWithCallback on ${obj} with its getValueCallback.`();
            expect.fail('Should be caught by coming soon error');
        } catch (error) {
            expect(error).toBeInstanceOf(ComingSoon);
        }
    });

    /**mock
    Modifying value before callback.

    ```python
    try:
        obj.value = "updated"
        return obj.useOwnCallback()
    except Exception as e:
        raise AgentError(f"Test failed {type(e)=} {e=}")
    ```
    */
    it('should modify value before callback execution', async () => {
        const obj = new CallbackUser();
        await agenticPro<string>`Set value of ${obj} to "updated", then call useOwnCallback.`();
        expect(obj.value).toBe('updated');
    });
});

class NestedThis {
    outer: string = 'outer';

    getOuter(): string {
        return this.outer;
    }

    createNested(): { getOuter: () => string } {
        return {
            getOuter: () => this.outer,
        };
    }
}

describe('Nested This Tests', () => {
    /**mock
    Accessing this in nested object.

    ```python
    try:
        nested = obj.createNested()
        return nested.getOuter()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access this in nested object', async () => {
        const obj = new NestedThis();
        const result = await agenticPro<string>`Call createNested on ${obj}, then call getOuter on the result.`();
        expect(result).toBe('outer');
    });

    /**mock
    Modified outer from nested.

    ```python
    try:
        nested = obj.createNested()
        return nested.getOuter()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should modify outer value and access from nested', async () => {
        const obj = new NestedThis();
        obj.outer = 'modified';
        const result = await agenticPro<string>`Call createNested on ${obj}, then call getOuter on the result.`();
        expect(result).toBe('modified');
    });
});

class MethodReference {
    name: string = 'method-ref';

    getName(): string {
        return this.name;
    }

    getNameArrow = (): string => {
        return this.name;
    };

    executeMethod(method: () => string): string {
        return method();
    }
}

describe('Method Reference Tests', () => {
    /**mock
    Arrow method reference.

    ```python
    try:
        return obj.executeMethod(obj.getNameArrow)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call arrow method reference', async () => {
        const obj = new MethodReference();
        try {
            await agenticPro<string>`Get getNameArrow from ${obj} and call executeMethod with it.`();
            expect.fail('Should be caught by coming soon error');
        } catch (error) {
            expect(error).toBeInstanceOf(ComingSoon);
        }
    });
});
