import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class ArrayContainer {
    numbers: number[] = [1, 2, 3, 4, 5];
    strings: string[] = ['a', 'b', 'c'];
    mixed: (number | string)[] = [1, 'two', 3, 'four'];

    getNumbers(): number[] {
        return this.numbers;
    }

    addNumber(n: number): void {
        this.numbers.push(n);
    }
}

describe('Array Container Tests', () => {
    /**mock
    Getting numbers array.

    ```python
    try:
        return obj.numbers
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access array property', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<number[]>`Return the numbers array from ${obj}.`();
        expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    /**mock
    Getting element at index.

    ```python
    try:
        return obj.numbers[2]
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access array element by index', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<number>`Return the element at index 2 from the numbers array of ${obj}.`();
        expect(result).toBe(3);
    });

    /**mock
    Getting array length.

    ```python
    try:
        return len(obj.numbers)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should get array length', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<number>`Return the length of the numbers array from ${obj}.`();
        expect(result).toBe(5);
    });

    /**mock
    Adding element to array.

    ```python
    try:
        obj.numbers.append(6)
        return None
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it.fails('should modify array by adding element', async () => {
        const obj = new ArrayContainer();
        await agenticPro<void>`Add the number 6 to the numbers array of ${obj}.`();
        expect(obj.numbers).toEqual([1, 2, 3, 4, 5, 6]);
    });

    /**mock
    Getting mixed type array.

    ```python
    try:
        return obj.mixed
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access mixed type array', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<(number | string)[]>`Return the mixed array from ${obj}.`();
        expect(result).toEqual([1, 'two', 3, 'four']);
    });

    /**mock
    Calling method that returns array.

    ```python
    try:
        return obj.getNumbers()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should call method returning array', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<number[]>`Call getNumbers on ${obj}.`();
        expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    /**mock
    Calling method that modifies array.

    ```python
    try:
        obj.addNumber(10)
        return None
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should call method that modifies array', async () => {
        const obj = new ArrayContainer();
        await agenticPro<void>`Call addNumber on ${obj} with 10.`();
        expect(obj.numbers).toContain(10);
    });
});

function processArray(items: number[]): number {
    return items.reduce((sum, n) => sum + n, 0);
}

function getFirstElement<T>(array: T[]): T | undefined {
    return array[0];
}

function filterEven(numbers: number[]): number[] {
    return numbers.filter((n) => n % 2 === 0);
}

describe('Array Functions Tests', () => {
    /**mock
    Passing array to function.

    ```python
    try:
        return processArray(arr)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should pass array to function', async () => {
        const arr = [5, 10, 15, 20];
        const result = await agenticPro<number>`Call ${processArray} with ${arr}.`();
        expect(result).toBe(50);
    });

    /**mock
    Mapping array to double values.

    ```python
    try:
        return getFirstElement(arr)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should get first element using generic function', async () => {
        const arr = [10, 20, 30];
        const result = await agenticPro<number>`Call ${getFirstElement} with ${arr}.`();
        expect(result).toBe(10);
    });

    /**mock
    Filtering to even numbers.

    ```python
    try:
        return filterEven(arr)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should filter using function', async () => {
        const arr = [1, 2, 3, 4, 5, 6];
        const result = await agenticPro<number[]>`Call ${filterEven} with ${arr}.`();
        expect(result).toEqual([2, 4, 6]);
    });
});

describe('Array Methods Tests', () => {
    /**mock
    Summing array elements.

    ```python
    try:
        return [n * 2 for n in obj.numbers]
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use array method map', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<number[]>`Map the numbers array of ${obj} by doubling each element.`();
        expect(result).toEqual([2, 4, 6, 8, 10]);
    });

    /**mock
    Slicing array.

    ```python
    try:
        return [n for n in obj.numbers if n % 2 == 0]
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use array method filter', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<number[]>`Filter the numbers array of ${obj} to only even numbers.`();
        expect(result).toEqual([2, 4]);
    });

    /**mock
    Checking if array includes value.

    ```python
    try:
        return sum(obj.numbers)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use array method reduce', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<number>`Sum all numbers in the numbers array of ${obj}.`();
        expect(result).toBe(15);
    });

    /**mock
    Getting first element.

    ```python
    try:
        return obj.numbers[1:4]
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use array slice', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<number[]>`Get elements from index 1 to 3 from the numbers array of ${obj}.`();
        expect(result).toEqual([2, 3, 4]);
    });

    /**mock
    Filtering even numbers with function.

    ```python
    try:
        return 3 in obj.numbers
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use array includes', async () => {
        const obj = new ArrayContainer();
        const result = await agenticPro<boolean>`Check if the numbers array of ${obj} includes 3.`();
        expect(result).toBe(true);
    });
});
