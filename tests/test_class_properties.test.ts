// PASS: 9
// FAIL: 0

import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class BasicProperties {
    topLevelProperty: string = 'top-level';
    constructorProperty: number;

    constructor(value: number) {
        this.constructorProperty = value;
    }
}

describe('Basic Properties Tests', () => {
    /**mock
    Getting the top-level property.

    ```python
    return obj.topLevelProperty
    ```
    */
    it('should access top-level initialized property', async () => {
        const obj = new BasicProperties(42);
        const result = await agenticPro<string>`Return the topLevelProperty of ${obj}.`();
        expect(result).toBe('top-level');
    });

    /**mock
    Getting the constructor property.

    ```python
    return obj.constructorProperty
    ```
    */
    it('should access constructor-initialized property', async () => {
        const obj = new BasicProperties(42);
        const result = await agenticPro<number>`Return the constructorProperty of ${obj}.`();
        expect(result).toBe(42);
    });
});

class GetterSetterProperties {
    private _internalValue: number = 0;

    get value(): number {
        return this._internalValue;
    }

    set value(newValue: number) {
        this._internalValue = newValue * 2;
    }
}

describe('Getter Setter Properties Tests', () => {
    /**mock
    Getting the value through the getter.

    ```python
    return obj.value
    ```
    */
    it('should access getter property', async () => {
        const obj = new GetterSetterProperties();
        obj.value = 10;
        const result = await agenticPro<number>`Return the value property of ${obj}.`();
        expect(result).toBe(20);
    });

    /**mock
    Setting the value property.

    ```python
    obj.value = 5
    return None
    ```
    */
    it('should modify property via setter', async () => {
        const obj = new GetterSetterProperties();
        await agenticPro<void>`Set the value property of ${obj} to 5.`();
        expect(obj.value).toBe(10);
    });
});

class StaticProperties {
    static staticValue: string = 'static-data';
    instanceValue: string = 'instance-data';
}

describe('Static Properties Tests', () => {
    /**mock
    Accessing static property from class.

    ```python
    return StaticProperties.staticValue
    ```
    */
    it('should access static property', async () => {
        const result = await agenticPro<string>`Return the static property staticValue from ${StaticProperties}.`();
        expect(result).toBe('static-data');
    });

    /**mock
    Getting instance property.

    ```python
    return obj.instanceValue
    ```
    */
    it('should access instance property on class with statics', async () => {
        const obj = new StaticProperties();
        const result = await agenticPro<string>`Return the instanceValue property of ${obj}.`();
        expect(result).toBe('instance-data');
    });
});

class ReadonlyProperties {
    readonly immutableValue: string;

    constructor(value: string) {
        this.immutableValue = value;
    }
}

describe('Readonly Properties Tests', () => {
    /**mock
    Getting readonly property.

    ```python
    return obj.immutableValue
    ```
    */
    it('should access readonly property', async () => {
        const obj = new ReadonlyProperties('immutable');
        const result = await agenticPro<string>`Return the immutableValue of ${obj}.`();
        expect(result).toBe('immutable');
    });
});

class ComputedProperties {
    firstName: string;
    lastName: string;

    constructor(first: string, last: string) {
        this.firstName = first;
        this.lastName = last;
    }

    get fullName(): string {
        return `${this.firstName} ${this.lastName}`;
    }
}

describe('Computed Properties Tests', () => {
    /**mock
    Getting computed property via getter.

    ```python
    return obj.fullName
    ```
    */
    it('should access computed getter property', async () => {
        const obj = new ComputedProperties('John', 'Doe');
        const result = await agenticPro<string>`Return the fullName property of ${obj}.`();
        expect(result).toBe('John Doe');
    });

    /**mock
    Modifying firstName to affect computed property.

    ```python
    obj.firstName = "Alice"
    return None
    ```
    */
    it('should modify underlying property affecting computed property', async () => {
        const obj = new ComputedProperties('Jane', 'Smith');
        await agenticPro<void>`Change the firstName of ${obj} to "Alice".`();
        expect(obj.fullName).toBe('Alice Smith');
    });
});

class ClassWithPrivate {
    private prv: string;
    ordinary: string;

    publicMethod() {
        return 'public';
    }

    private privateMethod() {
        return 'private';
    }

    constructor(ordinary: string) {
        this.ordinary = ordinary;
        this.prv = 'private';
    }
}

describe('Drop Private Fields Tests', () => {
    /**mock
    ```python
    try:
        return _emit_stubs({"ClassWithPrivate": ClassWithPrivate})[0]
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access string index signature property', async () => {
        const result = await agenticPro<string>`hello ${ClassWithPrivate}.`();
        console.log(result);
        expect(result).toBe(`class ClassWithPrivate:
    ordinary: str
    def __init__(self, ordinary: str) -> None:
        """Initialize an instance of ClassWithPrivate."""
    def publicMethod(self) -> str: ...`);
    });
});
