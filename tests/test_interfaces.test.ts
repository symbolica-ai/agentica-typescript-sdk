import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

interface BasicInterface {
    name: string;
    age: number;
}

describe('Basic Interface Tests', () => {
    /**mock
    Getting property from basic interface object.

    ```python
    try:
        return obj.name
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access properties from object matching basic interface', async () => {
        const obj: BasicInterface = { name: 'Alice', age: 30 };
        const result = await agenticPro<string>`Return the name property of ${obj}.`();
        expect(result).toBe('Alice');
    });
});

interface InterfaceWithOptional {
    required: string;
    optional?: number;
}

describe('Interface with Optional Properties Tests', () => {
    /**mock
    Getting optional property when present.

    ```python
    try:
        return obj.optional
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should handle optional property when present', async () => {
        const obj: InterfaceWithOptional = { required: 'test', optional: 42 };
        const result = await agenticPro<number>`Return the optional property of ${obj}.`();
        expect(result).toBe(42);
    });

    /**mock
    Getting required property.

    ```python
    try:
        return obj.required
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should handle optional property when absent', async () => {
        const obj: InterfaceWithOptional = { required: 'test' };
        const result = await agenticPro<string>`Return the required property of ${obj}.`();
        expect(result).toBe('test');
    });
});

interface InterfaceWithMethods {
    getValue(): string;
    compute(x: number, y: number): number;
}

class ImplementsMethods implements InterfaceWithMethods {
    getValue(): string {
        return 'method-value';
    }

    compute(x: number, y: number): number {
        return x + y;
    }
}

describe('Interface with Methods Tests', () => {
    /**mock
    Calling getValue method.

    ```python
    try:
        return obj.getValue()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method from interface implementation', async () => {
        const obj = new ImplementsMethods();
        const result = await agenticPro<string>`Call getValue on ${obj}.`();
        expect(result).toBe('method-value');
    });

    /**mock
    Calling compute with parameters.

    ```python
    try:
        return obj.compute(15, 27)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method with parameters from interface', async () => {
        const obj = new ImplementsMethods();
        const result = await agenticPro<number>`Call compute on ${obj} with 15 and 27.`();
        expect(result).toBe(42);
    });
});

interface ExtendedInterface extends BasicInterface {
    email: string;
}

class _ImplementsExtended implements ExtendedInterface {
    name: string;
    age: number;
    email: string;

    constructor(name: string, age: number, email: string) {
        this.name = name;
        this.age = age;
        this.email = email;
    }
}

describe('Extended Interface Tests', () => {
    /**mock
    Getting property from extended interface.

    ```python
    try:
        return obj.email
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access properties from extended interface', async () => {
        const obj: ExtendedInterface = { name: 'Charlie', age: 35, email: 'charlie@test.com' };
        const result = await agenticPro<string>`Return the email property of ${obj}.`();
        expect(result).toBe('charlie@test.com');
    });
});

interface MultipleExtension extends BasicInterface, InterfaceWithOptional {
    id: number;
}

describe('Multiple Extension Interface Tests', () => {
    /**mock
    Getting id from multiple extension.

    ```python
    try:
        return obj.id
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access properties from multiple extended interface', async () => {
        const obj: MultipleExtension = { name: 'Eve', age: 32, required: 'data', id: 1 };
        const result = await agenticPro<number>`Return the id property of ${obj}.`();
        expect(result).toBe(1);
    });
});

interface InterfaceWithReadonly {
    readonly id: number;
    mutableField: string;
}

describe('Interface with Readonly Tests', () => {
    /**mock
    Getting readonly property.

    ```python
    try:
        return obj.id
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access readonly property', async () => {
        const obj: InterfaceWithReadonly = { id: 100, mutableField: 'can-change' };
        const result = await agenticPro<number>`Return the id of ${obj}.`();
        expect(result).toBe(100);
    });

    /**mock
    Modifying mutable field.

    ```python
    try:
        obj.mutableField = "modified"
        return None
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should modify mutable field in interface', async () => {
        const obj: InterfaceWithReadonly = { id: 200, mutableField: 'original' };
        await agenticPro<void>`Set the mutableField of ${obj} to "modified".`();
        expect(obj.mutableField).toBe('modified');
    });
});

class ImplementsBasic implements BasicInterface {
    name: string;
    age: number;

    constructor(name: string, age: number) {
        this.name = name;
        this.age = age;
    }
}

describe('Class Implementing Interface Tests', () => {
    /**mock
    Getting age from class implementing interface.

    ```python
    try:
        return obj.age
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should work with class implementing interface', async () => {
        const obj = new ImplementsBasic('Frank', 45);
        const result = await agenticPro<number>`Return the age of ${obj}.`();
        expect(result).toBe(45);
    });
});
