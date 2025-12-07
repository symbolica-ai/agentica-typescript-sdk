// PASS: 3
// FAIL: 12

import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class MapContainer {
    stringMap: Map<string, number>;
    numberMap: Map<number, string>;
    objectMap: Map<string, { value: number }>;

    constructor() {
        this.stringMap = new Map([
            ['one', 1],
            ['two', 2],
            ['three', 3],
        ]);
        this.numberMap = new Map([
            [1, 'first'],
            [2, 'second'],
            [3, 'third'],
        ]);
        this.objectMap = new Map([
            ['a', { value: 10 }],
            ['b', { value: 20 }],
        ]);
    }

    addToMap(key: string, value: number): void {
        this.stringMap.set(key, value);
    }
}

describe('Map Tests', () => {
    /**mock
    Getting Map property.

    ```python
    return obj.stringMap
    ```
    */
    it('should access Map property', async () => {
        const obj = new MapContainer();
        const result = await agenticPro<Map<string, number>>`Return the stringMap from ${obj}.`();
        expect(result).toBeInstanceOf(Map);
        expect(result.get('one')).toBe(1);
    });

    /**mock
    Getting value from Map by key.

    ```python
    return obj.stringMap.get("two")
    ```
    */
    it('should get value from Map by key', async () => {
        const obj = new MapContainer();
        const result = await agenticPro<number>`Get the value for key "two" from stringMap of ${obj}.`();
        expect(result).toBe(2);
    });

    /**mock
    Getting Map size.

    ```python
    return len(obj.stringMap)
    ```
    */
    it('should get Map size', async () => {
        const obj = new MapContainer();
        const result = await agenticPro<number>`Return the size of stringMap from ${obj}.`();
        expect(result).toBe(3);
    });

    /**mock
    Adding entry to Map.

    ```python
    try:
        obj.stringMap.set("four", 4)
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should add entry to Map', async () => {
        const obj = new MapContainer();
        await agenticPro<void>`Add key "four" with value 4 to stringMap of ${obj}.`();
        expect(obj.stringMap.get('four')).toBe(4);
    });

    /**mock
    Checking if Map has key.

    ```python
    try:
        return obj.stringMap.has("three")
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should check if Map has key', async () => {
        const obj = new MapContainer();
        const result = await agenticPro<boolean>`Check if stringMap of ${obj} has key "three".`();
        expect(result).toBe(true);
    });

    /**mock
    Getting all keys from Map.

    ```python
    try:
        return list(obj.stringMap.keys())
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should get all keys from Map', async () => {
        const obj = new MapContainer();
        const result = await agenticPro<string[]>`Return all keys from stringMap of ${obj}.`();
        expect(result).toEqual(expect.arrayContaining(['one', 'two', 'three']));
    });

    /**mock
    Getting all values from Map.

    ```python
    try:
        return list(obj.stringMap.values())
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should get all values from Map', async () => {
        const obj = new MapContainer();
        const result = await agenticPro<number[]>`Return all values from stringMap of ${obj}.`();
        expect(result).toEqual(expect.arrayContaining([1, 2, 3]));
    });

    /**mock
    Calling method that modifies Map.

    ```python
    try:
        obj.addToMap("five", 5)
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method that modifies Map', async () => {
        const obj = new MapContainer();
        await agenticPro<void>`Call addToMap on ${obj} with "five" and 5.`();
        expect(obj.stringMap.get('five')).toBe(5);
    });
});

class SetContainer {
    numberSet: Set<number>;
    stringSet: Set<string>;

    constructor() {
        this.numberSet = new Set([1, 2, 3, 4, 5]);
        this.stringSet = new Set(['alpha', 'beta', 'gamma']);
    }

    addToSet(value: number): void {
        this.numberSet.add(value);
    }
}

describe('Set Tests', () => {
    /**mock
    Getting Set property.

    ```python
    try:
        return obj.numberSet
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access Set property', async () => {
        const obj = new SetContainer();
        const result = await agenticPro<Set<number>>`Return the numberSet from ${obj}.`();
        expect(result).toBeInstanceOf(Set);
        expect(result.has(1)).toBe(true);
    });

    /**mock
    Getting Set size.

    ```python
    try:
        return len(obj.numberSet)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should get Set size', async () => {
        const obj = new SetContainer();
        const result = await agenticPro<number>`Return the size of numberSet from ${obj}.`();
        expect(result).toBe(5);
    });

    /**mock
    Checking if Set has value.

    ```python
    try:
        return obj.numberSet.has(3)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should check if Set has value', async () => {
        const obj = new SetContainer();
        const result = await agenticPro<boolean>`Check if numberSet of ${obj} has value 3.`();
        expect(result).toBe(true);
    });

    /**mock
    Adding value to Set.

    ```python
    try:
        obj.numberSet.add(6)
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should add value to Set', async () => {
        const obj = new SetContainer();
        await agenticPro<void>`Add 6 to numberSet of ${obj}.`();
        expect(obj.numberSet.has(6)).toBe(true);
    });

    /**mock
    Converting Set to Array.

    ```python
    try:
        return list(obj.numberSet)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should convert Set to Array', async () => {
        const obj = new SetContainer();
        const result = await agenticPro<number[]>`Convert numberSet of ${obj} to an array.`();
        expect(result).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    });

    /**mock
    Calling method that modifies Set.

    ```python
    try:
        obj.addToSet(10)
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method that modifies Set', async () => {
        const obj = new SetContainer();
        await agenticPro<void>`Call addToSet on ${obj} with 10.`();
        expect(obj.numberSet.has(10)).toBe(true);
    });

    /**mock
    Deleting from Set.

    ```python
    try:
        obj.numberSet.delete(3)
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should delete from Set', async () => {
        const obj = new SetContainer();
        await agenticPro<void>`Remove 3 from numberSet of ${obj}.`();
        expect(obj.numberSet.has(3)).toBe(false);
    });
});
