import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class UnionTypes {
    value: string | number;

    constructor(value: string | number) {
        this.value = value;
    }

    process(input: string | number | boolean): string {
        return `processed-${input}`;
    }
}

function acceptsOptional(required: string, optional?: number): string {
    return optional ? `${required}-${optional}` : required;
}

describe('Union Types Tests', () => {
    /**mock
    Getting string value from union.

    ```python
    return obj.value
    ```
    */
    it('should handle string in union type', async () => {
        const obj = new UnionTypes('text');
        const result = await agenticPro<string | number>`Return the value property of ${obj}.`();
        expect(result).toBe('text');
    });

    /**mock
    Getting number value from union.

    ```python
    return obj.value
    ```
    */
    it('should handle number in union type', async () => {
        const obj = new UnionTypes(42);
        const result = await agenticPro<string | number>`Return the value property of ${obj}.`();
        expect(result).toBe(42);
    });

    /**mock
    Calling with string parameter.

    ```python
    return obj.process("test")
    ```
    */
    it('should call method with union parameter (string)', async () => {
        const obj = new UnionTypes('initial');
        const result = await agenticPro<string>`Call process on ${obj} with "test".`();
        expect(result).toBe('processed-test');
    });

    /**mock
    Calling with number parameter.

    ```python
    return obj.process(123)
    ```
    */
    it('should call method with union parameter (number)', async () => {
        const obj = new UnionTypes('initial');
        const result = await agenticPro<string>`Call process on ${obj} with 123.`();
        expect(result).toBe('processed-123');
    });

    /**mock
    Calling with boolean parameter.

    ```python
    return obj.process(True)
    ```
    */
    it('should call method with union parameter (boolean)', async () => {
        const obj = new UnionTypes('initial');
        const result = await agenticPro<string>`Call process on ${obj} with true.`();
        expect(result).toBe('processed-true');
    });
});

class OptionalParameters {
    greet(name: string, greeting?: string): string {
        return greeting ? `${greeting}, ${name}` : `Hello, ${name}`;
    }

    calculate(a: number, b?: number, c?: number): number {
        return a + (b || 0) + (c || 0);
    }
}

describe('Optional Parameters Tests', () => {
    /**mock
    Calling with optional parameter not provided.

    ```python
    try:
        return obj.greet("Alice")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method with optional parameter not provided', async () => {
        const obj = new OptionalParameters();
        const result = await agenticPro<string>`Call greet on ${obj} with "Alice".`();
        expect(result).toBe('Hello, Alice');
    });

    /**mock
    Calling with optional parameter provided.

    ```python
    return obj.greet("Bob", "Hi")
    ```
    */
    it('should call method with optional parameter provided', async () => {
        const obj = new OptionalParameters();
        const result = await agenticPro<string>`Call greet on ${obj} with "Bob" and "Hi".`();
        expect(result).toBe('Hi, Bob');
    });

    /**mock
    Calling with all optional parameters.

    ```python
    return obj.calculate(10, 20, 30)
    ```
    */
    it('should call method with multiple optional parameters', async () => {
        const obj = new OptionalParameters();
        const result = await agenticPro<number>`Call calculate on ${obj} with 10, 20, 30.`();
        expect(result).toBe(60);
    });

    /**mock
    Calling with optional parameters omitted.

    ```python
    try:
        return obj.calculate(10)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method with some optional parameters omitted', async () => {
        const obj = new OptionalParameters();
        const result = await agenticPro<number>`Call calculate on ${obj} with just 10.`();
        expect(result).toBe(10);
    });
});

class NullableTypes {
    data: string | null = null;

    setData(value: string | null): void {
        this.data = value;
    }

    getData(): string | null {
        return this.data;
    }
}

describe('Nullable Types Tests', () => {
    /**mock
    Getting null value.

    ```python
    try:
        return obj.getData()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should handle null in nullable type', async () => {
        const obj = new NullableTypes();
        const result = await agenticPro<string | null>`Call getData on ${obj}.`();
        expect(result).toBeNull();
    });

    /**mock
    Setting null value.

    ```python
    try:
        obj.setData(None)
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should set null value', async () => {
        const obj = new NullableTypes();
        obj.data = 'test';
        await agenticPro<void>`Call setData on ${obj} with null.`();
        expect(obj.data).toBeNull();
    });

    /**mock
    Setting string on nullable type.

    ```python
    try:
        obj.setData("data")
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should set string value on nullable type', async () => {
        const obj = new NullableTypes();
        await agenticPro<void>`Call setData on ${obj} with "data".`();
        expect(obj.data).toBe('data');
    });
});

type ComplexUnion = { type: 'a'; valueA: string } | { type: 'b'; valueB: number };

function handleUnion(value: string | number): string {
    if (typeof value === 'string') {
        return `string: ${value}`;
    } else {
        return `number: ${value}`;
    }
}

describe('Complex Types Tests', () => {
    /**mock
    Function with string union.

    ```python
    try:
        return handleUnion("test")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call function with union parameter (string)', async () => {
        const result = await agenticPro<string>`Call ${handleUnion} with "test".`();
        expect(result).toBe('string: test');
    });

    /**mock
    Function with number union.

    ```python
    try:
        return handleUnion(42)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call function with union parameter (number)', async () => {
        const result = await agenticPro<string>`Call ${handleUnion} with 42.`();
        expect(result).toBe('number: 42');
    });

    /**mock
    Function with optional provided.

    ```python
    try:
        return acceptsOptional("first", 2)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call function with optional parameter', async () => {
        const result = await agenticPro<string>`Call ${acceptsOptional} with "first" and 2.`();
        expect(result).toBe('first-2');
    });

    /**mock
    Function with optional omitted.

    ```python
    try:
        return acceptsOptional("only")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call function with optional parameter omitted', async () => {
        const result = await agenticPro<string>`Call ${acceptsOptional} with just "only".`();
        expect(result).toBe('only');
    });
});

class TypeGuards {
    isString(value: string | number): value is string {
        return typeof value === 'string';
    }

    processValue(value: string | number): string {
        if (this.isString(value)) {
            return value.toUpperCase();
        } else {
            return value.toString();
        }
    }
}

describe('Type Guards Tests', () => {
    /**mock
    Type guard with string.

    ```python
    try:
        return obj.processValue("hello")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should use type guard with string', async () => {
        const obj = new TypeGuards();
        const result = await agenticPro<string>`Call processValue on ${obj} with "hello".`();
        expect(result).toBe('HELLO');
    });

    /**mock
    Type guard with number.

    ```python
    try:
        return obj.processValue(42)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should use type guard with number', async () => {
        const obj = new TypeGuards();
        const result = await agenticPro<string>`Call processValue on ${obj} with 42.`();
        expect(result).toBe('42');
    });
});

function processComplexUnion(data: ComplexUnion): string | number {
    if (data.type === 'a') {
        return data.valueA;
    } else {
        return data.valueB;
    }
}

describe('Processing complex Types Tests', () => {
    /**mock
    Complex union type a.

    ```python
    try:
        return processComplexUnion(data)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should handle complex union type (type a)', async () => {
        const data: ComplexUnion = { type: 'a', valueA: 'test' };
        const result = await agenticPro<string | number>`Call ${processComplexUnion} with ${data}.`();
        expect(result).toBe('test');
    });

    /**mock
    Complex union type b.

    ```python
    try:
        return processComplexUnion(data)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should handle complex union type (type b)', async () => {
        const data: ComplexUnion = { type: 'b', valueB: 42 };
        const result = await agenticPro<string | number>`Call ${processComplexUnion} with ${data}.`();
        expect(result).toBe(42);
    });
});
