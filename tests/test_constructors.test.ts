import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class PublicParameterProperties {
    constructor(
        public name: string,
        public age: number
    ) {}

    getInfo(): string {
        return `${this.name}, ${this.age}`;
    }
}

describe('Public Parameter Properties Tests', () => {
    /**mock
    Getting info from public parameters.

    ```python
    return obj.getInfo()
    ```
    */
    it('should create instance with public parameter properties', async () => {
        const obj = new PublicParameterProperties('Alice', 30);
        const result = await agenticPro<string>`Call getInfo on ${obj}.`();
        expect(result).toBe('Alice, 30');
    });

    /**mock
    Accessing public parameter property.

    ```python
    return obj.name
    ```
    */
    it('should access public parameter property directly', async () => {
        const obj = new PublicParameterProperties('Bob', 25);
        const result = await agenticPro<string>`Return the name property of ${obj}.`();
        expect(result).toBe('Bob');
    });

    /**mock
    Accessing private via method.

    ```python
    obj.name = "Modified"
    return None
    ```
    */
    it('should modify public parameter property', async () => {
        const obj = new PublicParameterProperties('Original', 30);
        await agenticPro<void>`Set the name property of ${obj} to "Modified".`();
        expect(obj.name).toBe('Modified');
    });
});

class PrivateParameterProperties {
    constructor(private secret: string) {}

    getSecret(): string {
        return this.secret;
    }
}

describe('Private Parameter Properties Tests', () => {
    /**mock
    Accessing readonly parameter property.

    ```python
    return obj.getSecret()
    ```
    */
    it('should access private parameter property via method', async () => {
        const obj = new PrivateParameterProperties('secret-value');
        const result = await agenticPro<string>`Call getSecret on ${obj}.`();
        expect(result).toBe('secret-value');
    });
});

class ReadonlyParameterProperties {
    constructor(
        public readonly id: number,
        public readonly code: string
    ) {}

    getId(): number {
        return this.id;
    }
}

describe('Readonly Parameter Properties Tests', () => {
    /**mock
    Accessing readonly property directly.

    ```python
    return obj.getId()
    ```
    */
    it('should access readonly parameter property', async () => {
        const obj = new ReadonlyParameterProperties(100, 'CODE-A');
        const result = await agenticPro<number>`Call getId on ${obj}.`();
        expect(result).toBe(100);
    });

    /**mock
    Public from mixed properties.

    ```python
    return obj.code
    ```
    */
    it('should access readonly property directly', async () => {
        const obj = new ReadonlyParameterProperties(200, 'CODE-B');
        const result = await agenticPro<string>`Return the code property of ${obj}.`();
        expect(result).toBe('CODE-B');
    });
});

class MixedParameterProperties {
    constructor(
        public name: string,
        private password: string,
        readonly id: number
    ) {}

    getName(): string {
        return this.name;
    }

    checkPassword(input: string): boolean {
        return this.password === input;
    }
}

describe('Mixed Parameter Properties Tests', () => {
    /**mock
    Private via method in mixed.

    ```python
    return obj.getName()
    ```
    */
    it('should access public property from mixed properties', async () => {
        const obj = new MixedParameterProperties('Charlie', 'pass123', 1);
        const result = await agenticPro<string>`Call getName on ${obj}.`();
        expect(result).toBe('Charlie');
    });

    /**mock
    Optional parameter when provided.

    ```python
    return obj.checkPassword("mypass")
    ```
    */
    it('should access private property via method in mixed properties', async () => {
        const obj = new MixedParameterProperties('Dave', 'mypass', 2);
        const result = await agenticPro<boolean>`Call checkPassword on ${obj} with "mypass".`();
        expect(result).toBe(true);
    });
});

class OptionalParameterProperties {
    constructor(
        public required: string,
        public optional?: number
    ) {}

    getOptional(): number | undefined {
        return this.optional;
    }
}

describe('Optional Parameter Properties Tests', () => {
    /**mock
    Optional parameter when not provided.

    ```python
    try:
        return obj.getOptional()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should handle optional parameter property when provided', async () => {
        const obj = new OptionalParameterProperties('test', 42);
        const result = await agenticPro<number | undefined>`Call getOptional on ${obj}.`();
        expect(result).toBe(42);
    });

    /**mock
    Default parameter not provided.

    ```python
    try:
        return obj.getCount()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it.fails('should handle optional parameter property when not provided', async () => {
        const obj = new OptionalParameterProperties('test');
        const result = await agenticPro<number | undefined>`Call getOptional on ${obj}.`();
        expect(result).toBeUndefined();
    });
});

class DefaultParameterProperties {
    constructor(
        public name: string,
        public count: number = 0,
        public active: boolean = true
    ) {}

    getCount(): number {
        return this.count;
    }

    isActive(): boolean {
        return this.active;
    }
}

describe('Default Parameter Properties Tests', () => {
    /**mock
    Default parameter value.

    ```python
    try:
        return obj.getCount()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should use default parameter value when not provided', async () => {
        const obj = new DefaultParameterProperties('test');
        const result = await agenticPro<number>`Call getCount on ${obj}.`();
        expect(result).toBe(0);
    });
});

class ManualInitialization {
    name: string;
    value: number;

    constructor(name: string, value: number) {
        this.name = name.toUpperCase();
        this.value = value * 2;
    }
}

describe('Manual Initialization Tests', () => {
    /**mock
    Transformed value in manual init.

    ```python
    try:
        return obj.name
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access manually initialized property', async () => {
        const obj = new ManualInitialization('test', 5);
        const result = await agenticPro<string>`Return the name property of ${obj}.`();
        expect(result).toBe('TEST');
    });

    /**mock
    Base property from derived class.

    ```python
    try:
        return obj.value
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access transformed value in manual initialization', async () => {
        const obj = new ManualInitialization('value', 10);
        const result = await agenticPro<number>`Return the value property of ${obj}.`();
        expect(result).toBe(20);
    });
});

class InheritedConstructor {
    constructor(public base: string) {}
}

class DerivedConstructor extends InheritedConstructor {
    constructor(
        base: string,
        public derived: number
    ) {
        super(base);
    }

    getAll(): string {
        return `${this.base}-${this.derived}`;
    }
}

describe('Constructor Inheritance Tests', () => {
    /**mock
    Derived property.

    ```python
    try:
        return obj.base
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access base property from derived class', async () => {
        const obj = new DerivedConstructor('base-value', 42);
        const result = await agenticPro<string>`Return the base property of ${obj}.`();
        expect(result).toBe('base-value');
    });

    /**mock
    Method using base and derived.

    ```python
    try:
        return obj.derived
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access derived property', async () => {
        const obj = new DerivedConstructor('base', 10);
        const result = await agenticPro<number>`Return the derived property of ${obj}.`();
        expect(result).toBe(10);
    });

    /**mock
    Parameter property in complex init.

    ```python
    try:
        return obj.getAll()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should call method using both base and derived properties', async () => {
        const obj = new DerivedConstructor('test', 99);
        const result = await agenticPro<string>`Call getAll on ${obj}.`();
        expect(result).toBe('test-99');
    });
});

class ComplexInitialization {
    public computed: string;

    constructor(
        public first: string,
        public second: number
    ) {
        this.computed = `${first}-${second}`;
    }

    getComputed(): string {
        return this.computed;
    }
}

describe('Complex Initialization Tests', () => {
    /**mock
    Computed property from complex init.

    ```python
    try:
        return obj.first
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access parameter property in complex initialization', async () => {
        const obj = new ComplexInitialization('first', 123);
        const result = await agenticPro<string>`Return the first property of ${obj}.`();
        expect(result).toBe('first');
    });

    /**mock
    Modifying public parameter property.

    ```python
    try:
        return obj.getComputed()
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('should access computed property from complex initialization', async () => {
        const obj = new ComplexInitialization('value', 456);
        const result = await agenticPro<string>`Call getComputed on ${obj}.`();
        expect(result).toBe('value-456');
    });
});
