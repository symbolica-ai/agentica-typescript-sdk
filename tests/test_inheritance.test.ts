//
// TRIVIAL? Consider removal
//

import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class BaseClass {
    baseProperty: string = 'base';

    baseMethod(): string {
        return 'base-method';
    }

    overridableMethod(): string {
        return 'base-overridable';
    }
}

class DerivedClass extends BaseClass {
    derivedProperty: string = 'derived';

    derivedMethod(): string {
        return 'derived-method';
    }

    overridableMethod(): string {
        return 'derived-overridable';
    }
}

describe('Basic Inheritance Tests', () => {
    /**mock
    Getting base property from derived instance.

    ```python
    return obj.baseProperty
    ```
    */
    it('should access base class property', async () => {
        const obj = new DerivedClass();
        const result = await agenticPro<string>`Return the baseProperty of ${obj}.`();
        expect(result).toBe('base');
    });

    /**mock
    Getting derived property.

    ```python
    return obj.derivedProperty
    ```
    */
    it('should access derived class property', async () => {
        const obj = new DerivedClass();
        const result = await agenticPro<string>`Return the derivedProperty of ${obj}.`();
        expect(result).toBe('derived');
    });

    /**mock
    Calling base method.

    ```python
    return obj.baseMethod()
    ```
    */
    it('should call base class method', async () => {
        const obj = new DerivedClass();
        const result = await agenticPro<string>`Call baseMethod on ${obj}.`();
        expect(result).toBe('base-method');
    });

    /**mock
    Calling derived method.

    ```python
    return obj.derivedMethod()
    ```
    */
    it('should call derived class method', async () => {
        const obj = new DerivedClass();
        const result = await agenticPro<string>`Call derivedMethod on ${obj}.`();
        expect(result).toBe('derived-method');
    });

    /**mock
    Calling overridden method.

    ```python
    return obj.overridableMethod()
    ```
    */
    it('should call overridden method', async () => {
        const obj = new DerivedClass();
        const result = await agenticPro<string>`Call overridableMethod on ${obj}.`();
        expect(result).toBe('derived-overridable');
    });
});

class Animal {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    speak(): string {
        return 'generic sound';
    }

    getName(): string {
        return this.name;
    }
}

class Dog extends Animal {
    breed: string;

    constructor(name: string, breed: string) {
        super(name);
        this.breed = breed;
    }

    speak(): string {
        return 'woof';
    }

    getBreed(): string {
        return this.breed;
    }
}

class Cat extends Animal {
    indoor: boolean;

    constructor(name: string, indoor: boolean) {
        super(name);
        this.indoor = indoor;
    }

    speak(): string {
        return 'meow';
    }

    isIndoor(): boolean {
        return this.indoor;
    }
}

describe('Animal Hierarchy Tests', () => {
    /**mock
    Getting parent property via method.

    ```python
    return obj.getName()
    ```
    */
    it('should access constructor-initialized property from parent', async () => {
        const obj = new Dog('Buddy', 'Golden Retriever');
        const result = await agenticPro<string>`Call getName on ${obj}.`();
        expect(result).toBe('Buddy');
    });

    /**mock
    Getting derived class specific property.

    ```python
    return obj.getBreed()
    ```
    */
    it('should access derived class specific property', async () => {
        const obj = new Dog('Max', 'Labrador');
        const result = await agenticPro<string>`Call getBreed on ${obj}.`();
        expect(result).toBe('Labrador');
    });

    /**mock
    Calling overridden speak method.

    ```python
    return obj.speak()
    ```
    */
    it('should call overridden speak method on Dog', async () => {
        const obj = new Dog('Rex', 'Beagle');
        const result = await agenticPro<string>`Call speak on ${obj}.`();
        expect(result).toBe('woof');
    });

    /**mock
    Calling Cat specific method.

    ```python
    return obj.isIndoor()
    ```
    */
    it('should access Cat specific method', async () => {
        const obj = new Cat('Mittens', false);
        const result = await agenticPro<boolean>`Call isIndoor on ${obj}.`();
        expect(result).toBe(false);
    });

    /**mock
    Polymorphism with derived class as base type.

    ```python
    return animal.speak()
    ```
    */
    it('should work with polymorphism (Dog as Animal)', async () => {
        const animal: Animal = new Dog('Spot', 'Dalmatian');
        const result = await agenticPro<string>`Call speak on ${animal}.`();
        expect(result).toBe('woof');
    });
});

abstract class Shape {
    abstract getArea(): number;
    abstract getPerimeter(): number;

    describe(): string {
        return `Shape with area ${this.getArea()}`;
    }
}

class Rectangle extends Shape {
    width: number;
    height: number;

    constructor(width: number, height: number) {
        super();
        this.width = width;
        this.height = height;
    }

    getArea(): number {
        return this.width * this.height;
    }

    getPerimeter(): number {
        return 2 * (this.width + this.height);
    }
}

class Circle extends Shape {
    radius: number;

    constructor(radius: number) {
        super();
        this.radius = radius;
    }

    getArea(): number {
        return Math.PI * this.radius ** 2;
    }

    getPerimeter(): number {
        return 2 * Math.PI * this.radius;
    }
}

describe('Abstract Class Tests', () => {
    /**mock
    Abstract method on Rectangle.

    ```python
    return shape.getArea()
    ```
    */
    it('should call abstract method implementation on Rectangle', async () => {
        const shape = new Rectangle(5, 10);
        const result = await agenticPro<number>`Call getArea on ${shape}.`();
        expect(result).toBe(50);
    });

    /**mock
    Another abstract method on Rectangle.

    ```python
    return shape.getPerimeter()
    ```
    */
    it('should call another abstract method on Rectangle', async () => {
        const shape = new Rectangle(4, 6);
        const result = await agenticPro<number>`Call getPerimeter on ${shape}.`();
        expect(result).toBe(20);
    });

    /**mock
    Abstract method on Circle.

    ```python
    return shape.getArea()
    ```
    */
    it('should call abstract method implementation on Circle', async () => {
        const shape = new Circle(5);
        const result = await agenticPro<number>`Call getArea on ${shape}.`();
        expect(result).toBeCloseTo(78.54, 1);
    });

    /**mock
    Base method from abstract class.

    ```python
    return shape.describe()
    ```
    */
    it('should call base method from abstract class', async () => {
        const shape = new Rectangle(3, 4);
        const result = await agenticPro<string>`Call describe on ${shape}.`();
        expect(result).toBe('Shape with area 12');
    });
});
