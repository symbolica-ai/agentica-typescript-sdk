import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

const simpleObject = {
    name: 'simple',
    value: 42,
    active: true,
};

describe('Simple Object Tests', () => {
    /**mock
    Getting property from simple object.

    ```python
    try:
        return simpleObject.name
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access simple object property', async () => {
        const result = await agenticPro<string>`Return the name property of ${simpleObject}.`();
        expect(result).toBe('simple');
    });

    /**mock
    Modifying object property.

    ```python
    try:
        simpleObject.value = 100
        return simpleObject.value
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should modify object property', async () => {
        await agenticPro<number>`Set the value property of ${simpleObject} to 100.`();
        expect(simpleObject.value).toBe(100);
    });
});

const nestedObject = {
    user: {
        name: 'Alice',
        profile: {
            age: 30,
            email: 'alice@test.com',
        },
    },
    settings: {
        theme: 'dark',
        notifications: true,
    },
};

describe('Nested Object Tests', () => {
    /**mock
    Getting nested user name.

    ```python
    return nestedObject.user.name
    ```
    */
    it('should access nested object property', async () => {
        const result = await agenticPro<string>`Return the name from user in ${nestedObject}.`();
        expect(result).toBe('Alice');
    });

    /**mock
    Getting deeply nested email.

    ```python
    try:
        return nestedObject.user.profile.email
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access deeply nested property', async () => {
        const result = await agenticPro<string>`Return the email from user.profile in ${nestedObject}.`();
        expect(result).toBe('alice@test.com');
    });

    /**mock
    Getting theme from settings.

    ```python
    try:
        return nestedObject.settings.theme
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access multiple nested paths', async () => {
        const result = await agenticPro<string>`Return the theme from settings in ${nestedObject}.`();
        expect(result).toBe('dark');
    });
});

const objectWithMethods = {
    count: 0,
    increment() {
        this.count += 1;
        return this.count;
    },
    add(n: number) {
        this.count += n;
        return this.count;
    },
};

describe('Object with Methods Tests', () => {
    /**mock
    Calling increment method.

    ```python
    try:
        return objectWithMethods.increment()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method on object literal', async () => {
        objectWithMethods.count = 0;
        const result = await agenticPro<number>`Call increment on ${objectWithMethods}.`();
        expect(result).toBeGreaterThanOrEqual(1);
    });

    /**mock
    Calling add method.

    ```python
    try:
        return objectWithMethods.add(5)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method with parameter on object', async () => {
        objectWithMethods.count = 0;
        const result = await agenticPro<number>`Call add on ${objectWithMethods} with 5.`();
        expect(result).toBeGreaterThanOrEqual(5);
    });
});

const objectWithArrays = {
    items: [1, 2, 3],
    names: ['a', 'b', 'c'],
    nested: [
        { id: 1, value: 'first' },
        { id: 2, value: 'second' },
    ],
};

describe('Object with Arrays Tests', () => {
    /**mock
    Getting items array.

    ```python
    try:
        return objectWithArrays.items
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access array within object', async () => {
        const result = await agenticPro<number[]>`Return the items array from ${objectWithArrays}.`();
        expect(result).toEqual([1, 2, 3]);
    });

    /**mock
    Getting element from names array.

    ```python
    try:
        return objectWithArrays.names[1]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access element from array in object', async () => {
        const result = await agenticPro<string>`Return the second element from names in ${objectWithArrays}.`();
        expect(result).toBe('b');
    });

    /**mock
    Getting value from nested array object.

    ```python
    return objectWithArrays.nested[0].value
    ```
    */
    it('should access nested object in array', async () => {
        const result =
            await agenticPro<string>`Return the value from the first item in nested array of ${objectWithArrays}.`();
        expect(result).toBe('first');
    });
});

class ObjectContainer {
    data: { key: string; value: number };
    nested: { outer: { inner: string } };

    constructor() {
        this.data = { key: 'test', value: 100 };
        this.nested = { outer: { inner: 'deep-value' } };
    }

    getObject(): { result: string; count: number } {
        return { result: 'success', count: 5 };
    }
}

describe('Object in Class Tests', () => {
    /**mock
    Getting key from data object.

    ```python
    try:
        return obj.data.key
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access object property from class', async () => {
        const obj = new ObjectContainer();
        const result = await agenticPro<string>`Return the key from data in ${obj}.`();
        expect(result).toBe('test');
    });

    /**mock
    Getting deeply nested inner value.

    ```python
    try:
        return obj.nested.outer.inner
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access deeply nested property in class', async () => {
        const obj = new ObjectContainer();
        const result = await agenticPro<string>`Return the inner value from nested.outer in ${obj}.`();
        expect(result).toBe('deep-value');
    });

    /**mock
    Calling method that returns object.

    ```python
    try:
        return obj.getObject()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method returning object', async () => {
        const obj = new ObjectContainer();
        const result = await agenticPro<{ result: string; count: number }>`Call getObject on ${obj}.`();
        expect(result).toEqual({ result: 'success', count: 5 });
    });

    /**mock
    Getting property from returned object.

    ```python
    try:
        return obj.getObject().result
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access property from returned object', async () => {
        const obj = new ObjectContainer();
        const result = await agenticPro<string>`Call getObject on ${obj} and return the result property.`();
        expect(result).toBe('success');
    });
});

function createObject(name: string, value: number): { name: string; value: number; doubled: number } {
    return { name, value, doubled: value * 2 };
}

function extractProperty(obj: { [key: string]: unknown }, key: string): unknown {
    return obj[key];
}

describe('Object Functions Tests', () => {
    /**mock
    Creating object with function.

    ```python
    try:
        return createObject("test", 10)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call function that creates object', async () => {
        const result = await agenticPro<{
            name: string;
            value: number;
            doubled: number;
        }>`Call ${createObject} with "test" and 10.`();
        expect(result).toEqual({ name: 'test', value: 10, doubled: 20 });
    });

    /**mock
    Dynamic property access.

    ```python
    try:
        return extractProperty(obj, "beta")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should use dynamic property access', async () => {
        const obj = { alpha: 1, beta: 2, gamma: 3 };
        const result = await agenticPro<number>`Call ${extractProperty} with ${obj} and "beta".`();
        expect(result).toBe(2);
    });

    /**mock
    Getting object keys using dir() for introspection.

    ```python
    return [attr for attr in dir(obj) if not attr.startswith('_')]
    ```
    */
    it('should get object keys', async () => {
        const obj = { a: 1, b: 2, c: 3 };
        const result = await agenticPro<string[]>`Return all keys from ${obj}.`();
        expect(result).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    });
});
