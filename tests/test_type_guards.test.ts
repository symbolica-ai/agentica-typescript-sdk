import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number';
}

function processWithTypeOf(value: string | number): string {
    if (typeof value === 'string') {
        return `string: ${value}`;
    } else {
        return `number: ${value}`;
    }
}

describe('TypeOf Guards Tests', () => {
    /**mock
    Using typeof with string.

    ```python
    return processWithTypeOf("test")
    ```
    */
    it('should use typeof guard with string', async () => {
        const result = await agenticPro<string>`Call ${processWithTypeOf} with "test".`();
        expect(result).toBe('string: test');
    });

    /**mock
    Using typeof with number.

    ```python
    return processWithTypeOf(42)
    ```
    */
    it('should use typeof guard with number', async () => {
        const result = await agenticPro<string>`Call ${processWithTypeOf} with 42.`();
        expect(result).toBe('number: 42');
    });

    /**mock
    Custom type guard for string.

    ```python
    return isString("hello")
    ```
    */
    it('should use custom type guard for string', async () => {
        const result = await agenticPro<boolean>`Call ${isString} with "hello".`();
        expect(result).toBe(true);
    });

    /**mock
    Custom type guard for number.

    ```python
    return isNumber(100)
    ```
    */
    it('should use custom type guard for number', async () => {
        const result = await agenticPro<boolean>`Call ${isNumber} with 100.`();
        expect(result).toBe(true);
    });

    /**mock
    String type guard fails with number.

    ```python
    return isString(42)
    ```
    */
    it('should fail string type guard with number', async () => {
        const result = await agenticPro<boolean>`Call ${isString} with 42.`();
        expect(result).toBe(false);
    });
});

class Animal {
    name: string;
    constructor(name: string) {
        this.name = name;
    }
}

class Dog extends Animal {
    bark(): string {
        return 'woof';
    }
}

class Cat extends Animal {
    meow(): string {
        return 'meow';
    }
}

function isDog(animal: Animal): animal is Dog {
    return animal instanceof Dog;
}

function processAnimal(animal: Animal): string {
    if (animal instanceof Dog) {
        return animal.bark();
    } else if (animal instanceof Cat) {
        return (animal as Cat).meow();
    }
    return 'unknown';
}

describe('InstanceOf Guards Tests', () => {
    /**mock
    Using instanceof with Dog.

    ```python
    return processAnimal(dog)
    ```
    */
    it('should use instanceof with Dog', async () => {
        const dog = new Dog('Buddy');
        const result = await agenticPro<string>`Call ${processAnimal} with ${dog}.`();
        expect(result).toBe('woof');
    });

    /**mock
    Using instanceof with Cat.

    ```python
    return processAnimal(cat)
    ```
    */
    it('should use instanceof with Cat', async () => {
        const cat = new Cat('Whiskers');
        const result = await agenticPro<string>`Call ${processAnimal} with ${cat}.`();
        expect(result).toBe('meow');
    });

    /**mock
    Custom instanceof guard.

    ```python
    return isDog(dog)
    ```
    */
    it('should use custom instanceof guard', async () => {
        const dog = new Dog('Rex');
        const result = await agenticPro<boolean>`Call ${isDog} with ${dog}.`();
        expect(result).toBe(true);
    });

    /**mock
    Instanceof guard fails with Cat.

    ```python
    return isDog(cat)
    ```
    */
    it('should fail instanceof guard with Cat', async () => {
        const cat = new Cat('Fluffy');
        const result = await agenticPro<boolean>`Call ${isDog} with ${cat}.`();
        expect(result).toBe(false);
    });
});

interface Square {
    kind: 'square';
    size: number;
}

interface Rectangle {
    kind: 'rectangle';
    width: number;
    height: number;
}

type Shape = Square | Rectangle;

function isSquare(shape: Shape): shape is Square {
    return shape.kind === 'square';
}

function getArea(shape: Shape): number {
    if (shape.kind === 'square') {
        return shape.size * shape.size;
    } else {
        return shape.width * shape.height;
    }
}

describe('Discriminated Union Tests', () => {
    /**mock
    Discriminated union with square.

    ```python
    return getArea(square)
    ```
    */
    it('should use discriminated union with square', async () => {
        const square: Square = { kind: 'square', size: 5 };
        const result = await agenticPro<number>`Call ${getArea} with ${square}.`();
        expect(result).toBe(25);
    });

    /**mock
    Discriminated union with rectangle.

    ```python
    return getArea(rect)
    ```
    */
    it('should use discriminated union with rectangle', async () => {
        const rect: Rectangle = { kind: 'rectangle', width: 4, height: 6 };
        const result = await agenticPro<number>`Call ${getArea} with ${rect}.`();
        expect(result).toBe(24);
    });

    /**mock
    Custom discriminated union guard.

    ```python
    return isSquare(square)
    ```
    */
    it('should use custom discriminated union guard', async () => {
        const square: Square = { kind: 'square', size: 10 };
        const result = await agenticPro<boolean>`Call ${isSquare} with ${square}.`();
        expect(result).toBe(true);
    });
});

class TypeGuardUser {
    processValue(value: string | number | boolean): string {
        if (typeof value === 'string') {
            return `str: ${value}`;
        } else if (typeof value === 'number') {
            return `num: ${value}`;
        } else {
            return `bool: ${value}`;
        }
    }

    checkInstance(obj: unknown): string {
        if (obj instanceof Dog) {
            return 'dog';
        } else if (obj instanceof Cat) {
            return 'cat';
        } else if (obj instanceof Animal) {
            return 'animal';
        }
        return 'other';
    }
}

describe('Type Guards in Class Tests', () => {
    /**mock
    Processing string in class.

    ```python
    return user.processValue("text")
    ```
    */
    it('should process string in class method', async () => {
        const user = new TypeGuardUser();
        const result = await agenticPro<string>`Call processValue on ${user} with "text".`();
        expect(result).toBe('str: text');
    });

    /**mock
    Processing number in class.

    ```python
    return user.processValue(42)
    ```
    */
    it('should process number in class method', async () => {
        const user = new TypeGuardUser();
        const result = await agenticPro<string>`Call processValue on ${user} with 42.`();
        expect(result).toBe('num: 42');
    });

    /**mock
    Processing boolean in class.

    ```python
    return user.processValue(True)
    ```
    */
    it('should process boolean in class method', async () => {
        const user = new TypeGuardUser();
        const result = await agenticPro<string>`Call processValue on ${user} with true.`();
        expect(result).toBe('bool: true');
    });

    /**mock
    Checking Dog instance.

    ```python
    return user.checkInstance(dog)
    ```
    */
    it('should check Dog instance in class', async () => {
        const user = new TypeGuardUser();
        const dog = new Dog('Max');
        const result = await agenticPro<string>`Call checkInstance on ${user} with ${dog}.`();
        expect(result).toBe('dog');
    });

    /**mock
    Checking Cat instance.

    ```python
    return user.checkInstance(cat)
    ```
    */
    it('should check Cat instance in class', async () => {
        const user = new TypeGuardUser();
        const cat = new Cat('Mittens');
        const result = await agenticPro<string>`Call checkInstance on ${user} with ${cat}.`();
        expect(result).toBe('cat');
    });
});

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

function processUnknown(value: unknown): string {
    if (typeof value === 'string') {
        return value.toUpperCase();
    } else if (typeof value === 'number') {
        return value.toString();
    } else if (Array.isArray(value)) {
        return `array of ${value.length}`;
    }
    return 'unknown';
}

function hasProperty(obj: unknown, prop: string): boolean {
    return prop in (obj as object);
}

describe('Unknown Type Guards Tests', () => {
    /**mock
    Using Array.isArray guard.

    ```python
    return isArray(arr)
    ```
    */
    it('should use Array.isArray guard', async () => {
        const arr = [1, 2, 3];
        const result = await agenticPro<boolean>`Call ${isArray} with ${arr}.`();
        expect(result).toBe(true);
    });

    /**mock
    Processing unknown string.

    ```python
    return processUnknown("hello")
    ```
    */
    it('should process unknown string', async () => {
        const result = await agenticPro<string>`Call ${processUnknown} with "hello".`();
        expect(result).toBe('HELLO');
    });

    /**mock
    Processing unknown array.

    ```python
    return processUnknown(arr)
    ```
    */
    it('should process unknown array', async () => {
        const arr = [1, 2, 3, 4, 5];
        const result = await agenticPro<string>`Call ${processUnknown} with ${arr}.`();
        expect(result).toBe('array of 5');
    });

    /**mock
    Checking property existence.

    ```python
    return hasProperty(obj, "name")
    ```
    */
    it('should check property existence', async () => {
        const obj = { name: 'test', value: 42 };
        const result = await agenticPro<boolean>`Call ${hasProperty} with ${obj} and "name".`();
        expect(result).toBe(true);
    });

    /**mock
    Checking missing property.

    ```python
    return hasProperty(obj, "missing")
    ```
    */
    it('should check missing property', async () => {
        const obj = { existing: true };
        const result = await agenticPro<boolean>`Call ${hasProperty} with ${obj} and "missing".`();
        expect(result).toBe(false);
    });
});
