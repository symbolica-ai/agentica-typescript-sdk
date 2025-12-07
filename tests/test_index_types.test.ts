import { agenticPro } from '@agentica/agentic';
import { assert, describe, expect, it } from 'vitest';

interface StringIndex {
    [key: string]: number;
}

interface NumberIndex {
    [index: number]: string;
}

interface MixedIndex {
    [key: string]: number | string;
    required: number;
}

describe('Index Signature Tests', () => {
    /**mock
    Accessing string index signature.

    ```python
    try:
        return obj["b"]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access string index signature property', async () => {
        const obj: StringIndex = { a: 1, b: 2, c: 3 };
        const result = await agenticPro<number>`Return the value for key "b" from ${obj}.`();
        expect(result).toBe(2);
    });

    /**mock
    Setting string index signature.

    ```python
    raise AgentError("We send things by value, so this can't work for now")
    try:
        obj["newKey"] = 20
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    // We send by value, so this can't work for now
    it.fails('should set string index signature property', async () => {
        const obj: StringIndex = { existing: 10 };
        await agenticPro<void>`Set key "newKey" to 20 in ${obj}.`();
        expect(obj['newKey']).toBe(20);
    });

    /**mock
    Accessing number index.

    ```python
    try:
        return obj[1]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access number index signature', async () => {
        const obj: NumberIndex = { 0: 'first', 1: 'second', 2: 'third' };
        const result = await agenticPro<string>`Return the value at index 1 from ${obj}.`();
        expect(result).toBe('second');
    });

    /**mock
    Accessing float index.

    ```python
    try:
        return obj[1.5]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access float index signature', async () => {
        const obj: NumberIndex = { 1.5: 'one-point-five', 2.7: 'two-point-seven' };
        const result = await agenticPro<string>`Return the value at index 1.5 from ${obj}.`();
        expect(result).toBe('one-point-five');
    });

    /**mock
    Accessing negative index.

    ```python
    try:
        return obj[-5]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access negative index signature', async () => {
        const obj: NumberIndex = { [-5]: 'negative-five', [-10]: 'negative-ten' };
        const result = await agenticPro<string>`Return the value at index -5 from ${obj}.`();
        expect(result).toBe('negative-five');
    });

    /**mock
    Accessing scientific notation index.

    ```python
    try:
        return obj[100000]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access scientific notation index signature', async () => {
        const obj: NumberIndex = { 1e5: 'one-hundred-thousand' };
        const result = await agenticPro<string>`Return the value at index 100000.0 from ${obj}.`();
        expect(result).toBe('one-hundred-thousand');
    });

    /**mock
    Accessing mixed index signature.

    ```python
    try:
        return obj.required
    except Exception:
        raise AgentError("This is expected to fail because we are currently deciding that the interface is a dict, and dicts don't have fields")
    ```
    */
    it('should access mixed index signature', async () => {
        const obj: MixedIndex = { required: 100, optional: 'text', another: 50 };
        const result = await agenticPro<number>`Return the required property from ${obj}.`();
        expect(result).toBe(100);
    });

    /**mock
    Verify dict protocol methods are synthesized for mixed index signatures.

    ```python
    try:
        return _emit_stubs({"obj": obj, "MixedIndex": MixedIndex})[0]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should have dict protocol methods in stubs', async () => {
        const obj: MixedIndex = { required: 100, optional: 'text', another: 50 };
        const result = await agenticPro<string>`Return ${obj} stubs`();
        expect(result).toContain('__getitem__');
        expect(result).toContain('__setitem__');
        expect(result).toContain('__delitem__');
        expect(result).toContain('__contains__');
    });

    /**mock
    Check if key exists in index signature using __contains__.

    ```python
    try:
        return "b" in obj
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should check if key exists using __contains__', async () => {
        const obj: StringIndex = { a: 1, b: 2, c: 3 };
        const result = await agenticPro<boolean>`Check if "b" is in ${obj}.`();
        expect(result).toBe(true);
    });

    /**mock
    Check if key does not exist in index signature using __contains__.

    ```python
    try:
        return "missing" in obj
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should check if key does not exist using __contains__', async () => {
        const obj: StringIndex = { a: 1, b: 2, c: 3 };
        const result = await agenticPro<boolean>`Check if "missing" is in ${obj}.`();
        expect(result).toBe(false);
    });

    /**mock
    Delete key from index signature using __delitem__.

    ```python
    try:
        del obj["b"]
        return "b" in obj
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should delete key using __delitem__', async () => {
        const obj: StringIndex = { a: 1, b: 2, c: 3 };
        const result = await agenticPro<boolean>`Delete key "b" from ${obj}, then check if "b" is still in it.`();
        expect(result).toBe(false);
    });

    /**mock
    Set value in index signature using __setitem__.

    ```python
    try:
        obj["newKey"] = 99
        return obj["newKey"]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should set value using __setitem__', async () => {
        const obj: StringIndex = { a: 1, b: 2 };
        const result = await agenticPro<number>`Set ${obj}["newKey"] = 99.`();
        expect(result).toBe(99);
    });

    /**mock
    KeyError when accessing non-existent key with __getitem__.

    ```python
    try:
        return obj["nonexistent"]
        return "Should have raised KeyError"
    except KeyError:
        return "KeyError raised"
    except Exception:
        raise AgentError("Wrong exception type")
    ```
    */
    it('should raise KeyError for __getitem__ on non-existent key', async () => {
        const obj: StringIndex = { a: 1, b: 2 };
        const result = await agenticPro<string>`Access ${obj}["nonexistent"].`();
        expect(result).toBe('KeyError raised');
    });

    /**mock
    KeyError when deleting non-existent key with __delitem__.

    ```python
    try:
        del obj["nonexistent"]
        return "Should have raised KeyError"
    except KeyError:
        return "KeyError raised"
    except Exception:
        raise AgentError("Wrong exception type")
    ```
    */
    it('should raise KeyError for __delitem__ on non-existent key', async () => {
        const obj: StringIndex = { a: 1, b: 2 };
        const result = await agenticPro<string>`Delete ${obj}["nonexistent"].`();
        expect(result).toBe('KeyError raised');
    });

    /**mock
    No error when checking non-existent key with __contains__.

    ```python
    try:
        was_in = "nonexistent" in obj
        return was_in
    except Exception:
        try:
            if not was_in:
                return "Correctly returned False"
            else:
                return "Should have returned False"
        except Exception:
            pass
        raise AgentError("Should not raise exception")
    ```
    */
    it('should not raise error for __contains__ on non-existent key', async () => {
        const obj: StringIndex = { a: 1, b: 2 };
        const result = await agenticPro<string>`Check if ${obj} has key "nonexistent".`();
        expect(result).toBe('Correctly returned False');
    });

    /**mock
    No error when setting new key with __setitem__.

    ```python
    try:
        obj["newKey"] = 42
        return "Successfully set new key"
    except Exception:
        raise AgentError("Should not raise exception when setting new key")
    ```
    */
    it('should not raise error for __setitem__ on new key', async () => {
        const obj: StringIndex = { a: 1, b: 2 };
        const result = await agenticPro<string>`Set ${obj}["newKey"] = 42.`();
        expect(result).toBe('Successfully set new key');
    });
});

class DynamicProperties {
    [key: string]: unknown;

    constructor() {
        this['dynamicProp'] = 'dynamic';
    }

    setProperty(key: string, value: unknown): void {
        this[key] = value;
    }

    getProperty(key: string): unknown {
        return this[key];
    }
}

describe('Dynamic Properties Tests', () => {
    /**mock
    Setting dynamic property.

    ```python
    try:
        obj.setProperty("test", "value")
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should set dynamic property', async () => {
        const obj = new DynamicProperties();
        await agenticPro<void>`Call setProperty on ${obj} with "test" and "value".`();
        expect(obj.getProperty('test')).toBe('value');
    });

    /**mock
    Getting dynamic property.

    ```python
    try:
        return obj.getProperty("myProp")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should get dynamic property', async () => {
        const obj = new DynamicProperties();
        obj.setProperty('myProp', 42);
        const result = await agenticPro<number>`Call getProperty on ${obj} with "myProp".`();
        expect(result).toBe(42);
    });
});

function createRecord(keys: string[], value: number): Record<string, number> {
    const result: Record<string, number> = {};
    keys.forEach((key) => (result[key] = value));
    return result;
}

function accessByKey(obj: Record<string, string>, key: string): string {
    return obj[key];
}

function getKeys(obj: Record<string, unknown>): string[] {
    return Object.keys(obj);
}

function getValues(obj: Record<string, number>): number[] {
    return Object.values(obj);
}

describe('Record Type Tests', () => {
    /**mock
    Creating Record type.

    ```python
    try:
        return createRecord(keys, 10)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should create Record type', async () => {
        const keys = ['a', 'b', 'c'];
        const result = await agenticPro<Record<string, number>>`Call ${createRecord} with ${keys} and 10.`();
        // createRecord returns a plain object, not a Map
        expect(result).toEqual({ a: 10, b: 10, c: 10 });
    });

    /**mock
    Accessing Record by key.

    ```python
    try:
        return accessByKey(obj, "role")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access Record by key', async () => {
        const obj: Record<string, string> = { name: 'Alice', role: 'Developer' };
        try {
            const result = await agenticPro<string>`Call ${accessByKey} with ${obj} and "role".`();
            expect(result).toBe('Developer');
        } catch {
            assert(false, 'Raised an exception');
        }
    });

    /**mock
    Getting keys from Record.

    ```python
    try:
        return getKeys(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should get keys from Record', async () => {
        const obj: Record<string, unknown> = { a: 1, b: 2, c: 3 };
        const result = await agenticPro<string[]>`Call ${getKeys} with ${obj}.`();
        expect(result).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    });

    /**mock
    Getting values from Record.

    ```python
    try:
        return getValues(obj)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should get values from Record', async () => {
        const obj: Record<string, number> = { x: 10, y: 20, z: 30 };
        const result = await agenticPro<number[]>`Call ${getValues} with ${obj}.`();
        expect(result).toEqual(expect.arrayContaining([10, 20, 30]));
    });

    /**mock
    Iterating and summing Record values.

    ```python
    try:
        return sum(getValues(obj))
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should iterate over Record keys', async () => {
        const obj: Record<string, number> = { first: 1, second: 2, third: 3 };
        const result = await agenticPro<number>`Sum all values in ${obj} using ${getValues}.`();
        expect(result).toBe(6);
    });

    /**mock
    Checking if Record has key.

    ```python
    try:
        return "exists" in obj
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should check if Record has key', async () => {
        const obj: Record<string, string> = { exists: 'yes' };
        const result = await agenticPro<boolean>`Check if ${obj} has key "exists".`();
        expect(result).toBe(true);
    });
});

class RecordContainer {
    data: Record<string, number> = {};

    set(key: string, value: number): void {
        this.data[key] = value;
    }

    get(key: string): number | undefined {
        return this.data[key];
    }

    getAll(): Record<string, number> {
        return this.data;
    }

    getSize(): number {
        return Object.keys(this.data).length;
    }
}

describe('Record Container Tests', () => {
    /**mock
    Setting value in Record container.

    ```python
    try:
        return container.set("key1", 100)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should set value in Record container', async () => {
        const container = new RecordContainer();
        await agenticPro<void>`Call set on ${container} with "key1" and 100.`();
        expect(container.get('key1')).toBe(100);
    });

    /**mock
    Getting value from Record container.

    ```python
    try:
        return container.get("myKey")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should get value from Record container', async () => {
        const container = new RecordContainer();
        container.set('myKey', 42);
        const result = await agenticPro<number | undefined>`Call get on ${container} with "myKey".`();
        expect(result).toBe(42);
    });

    /**mock
    Getting all data from Record container.

    ```python
    try:
        return container.getAll()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should get all data from Record container', async () => {
        const container = new RecordContainer();
        container.set('a', 1);
        container.set('b', 2);
        const result = await agenticPro<Record<string, number>>`Call getAll on ${container}.`();
        expect(result).toEqual({ a: 1, b: 2 });
    });

    /**mock
    Getting size of Record container.

    ```python
    try:
        return container.getSize()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should get size of Record container', async () => {
        const container = new RecordContainer();
        container.set('x', 1);
        container.set('y', 2);
        container.set('z', 3);
        const result = await agenticPro<number>`Call getSize on ${container}.`();
        expect(result).toBe(3);
    });
});

type NestedRecord = Record<string, Record<string, number>>;

function createNestedRecord(): NestedRecord {
    return {
        group1: { a: 1, b: 2 },
        group2: { c: 3, d: 4 },
    };
}

describe('Nested Record Tests', () => {
    /**mock
    Creating nested Record.

    ```python
    try:
        return createNestedRecord()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should create nested Record', async () => {
        const result = await agenticPro<NestedRecord>`Call ${createNestedRecord}.`();
        expect(result.group1.a).toBe(1);
        expect(result.group2.d).toBe(4);
    });

    /**mock
    Accessing nested Record value.

    ```python
    try:
        return nested["outer"]["inner"]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access nested Record value', async () => {
        const nested: NestedRecord = { outer: { inner: 99 } };
        const result = await agenticPro<number>`Return nested["outer"]["inner"] from ${nested}.`();
        expect(result).toBe(99);
    });
});
