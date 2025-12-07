import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class AccessModifiers {
    public publicField: string = 'public';
    private privateField: string = 'private';
    protected protectedField: string = 'protected';

    public publicMethod(): string {
        return 'public method';
    }

    private privateMethod(): string {
        return 'private method';
    }

    protected protectedMethod(): string {
        return 'protected method';
    }

    public accessPrivate(): string {
        return this.privateField;
    }

    public callPrivateMethod(): string {
        return this.privateMethod();
    }

    public accessProtected(): string {
        return this.protectedField;
    }
}

describe('Basic Access Modifiers Tests', () => {
    /**mock
    Accessing public field.

    ```python
    return obj.publicField
    ```
    */
    it('should access public field', async () => {
        const obj = new AccessModifiers();
        const result = await agenticPro<string>`Return the publicField of ${obj}.`();
        expect(result).toBe('public');
    });

    /**mock
    Calling public method.

    ```python
    return obj.publicMethod()
    ```
    */
    it('should call public method', async () => {
        const obj = new AccessModifiers();
        const result = await agenticPro<string>`Call publicMethod on ${obj}.`();
        expect(result).toBe('public method');
    });

    /**mock
    Accessing private via public method.

    ```python
    return obj.accessPrivate()
    ```
    */
    it('should access private field via public method', async () => {
        const obj = new AccessModifiers();
        const result = await agenticPro<string>`Call accessPrivate on ${obj}.`();
        expect(result).toBe('private');
    });

    /**mock
    Calling private method via public.

    ```python
    return obj.callPrivateMethod()
    ```
    */
    it('should call private method via public method', async () => {
        const obj = new AccessModifiers();
        const result = await agenticPro<string>`Call callPrivateMethod on ${obj}.`();
        expect(result).toBe('private method');
    });

    /**mock
    Accessing protected via public method.

    ```python
    return obj.accessProtected()
    ```
    */
    it('should access protected field via public method', async () => {
        const obj = new AccessModifiers();
        const result = await agenticPro<string>`Call accessProtected on ${obj}.`();
        expect(result).toBe('protected');
    });

    /**mock
    Modifying public field.

    ```python
    obj.publicField = "modified"
    return None
    ```
    */
    it('should modify public field', async () => {
        const obj = new AccessModifiers();
        await agenticPro<void>`Set the publicField of ${obj} to "modified".`();
        expect(obj.publicField).toBe('modified');
    });
});

class DerivedAccess extends AccessModifiers {
    public getProtectedField(): string {
        return this.protectedField;
    }

    public callProtectedMethod(): string {
        return this.protectedMethod();
    }

    public updateProtected(value: string): void {
        this.protectedField = value;
    }
}

describe('Protected Access in Derived Class Tests', () => {
    /**mock
    Getting protected from derived class.

    ```python
    return obj.getProtectedField()
    ```
    */
    it('should access protected field from derived class', async () => {
        const obj = new DerivedAccess();
        const result = await agenticPro<string>`Call getProtectedField on ${obj}.`();
        expect(result).toBe('protected');
    });

    /**mock
    Calling protected method from derived.

    ```python
    return obj.callProtectedMethod()
    ```
    */
    it('should call protected method from derived class', async () => {
        const obj = new DerivedAccess();
        const result = await agenticPro<string>`Call callProtectedMethod on ${obj}.`();
        expect(result).toBe('protected method');
    });

    /**mock
    Modifying protected from derived.

    ```python
    obj.updateProtected("modified")
    return None
    ```
    */
    it('should modify protected field from derived class', async () => {
        const obj = new DerivedAccess();
        await agenticPro<void>`Call updateProtected on ${obj} with "modified".`();
        expect(obj.getProtectedField()).toBe('modified');
    });
});

class StaticAccessModifiers {
    public static publicStatic: string = 'public static';
    private static privateStatic: string = 'private static';

    public static publicStaticMethod(): string {
        return 'public static method';
    }

    private static privateStaticMethod(): string {
        return 'private static method';
    }

    public static accessPrivateStatic(): string {
        return StaticAccessModifiers.privateStatic;
    }

    public static callPrivateStaticMethod(): string {
        return StaticAccessModifiers.privateStaticMethod();
    }
}

describe('Static Access Modifiers Tests', () => {
    /**mock
    Accessing public static field.

    ```python
    return StaticAccessModifiers.publicStatic
    ```
    */
    it('should access public static field', async () => {
        const result = await agenticPro<string>`Return the publicStatic property of ${StaticAccessModifiers}.`();
        expect(result).toBe('public static');
    });

    /**mock
    Calling public static method.

    ```python
    raise AgentError("Not implemented")
    return StaticAccessModifiers.publicStaticMethod()
    ```
    */
    it.fails('should call public static method', async () => {
        const result = await agenticPro<string>`Call publicStaticMethod on ${StaticAccessModifiers}.`();
        expect(result).toBe('public static method');
    });

    /**mock
    Accessing private static via public.

    ```python
    raise AgentError("Not implemented")
    return StaticAccessModifiers.accessPrivateStatic()
    ```
    */
    it.fails('should access private static via public static method', async () => {
        const result = await agenticPro<string>`Call accessPrivateStatic on ${StaticAccessModifiers}.`();
        expect(result).toBe('private static');
    });

    /**mock
    Calling private static via public.

    ```python
    raise AgentError("Not implemented")
    return StaticAccessModifiers.callPrivateStaticMethod()
    ```
    */
    it.fails('should call private static method via public static method', async () => {
        const result = await agenticPro<string>`Call callPrivateStaticMethod on ${StaticAccessModifiers}.`();
        expect(result).toBe('private static method');
    });
});

class ReadonlyAccessModifiers {
    public readonly publicReadonly: string;
    private readonly privateReadonly: number;

    constructor(pub: string, priv: number) {
        this.publicReadonly = pub;
        this.privateReadonly = priv;
    }

    public getPrivateReadonly(): number {
        return this.privateReadonly;
    }
}

describe('Readonly Access Modifiers Tests', () => {
    /**mock
    Accessing public readonly.

    ```python
    raise AgentError("Not implemented")
    return obj.publicReadonly
    ```
    */
    it.fails('should access public readonly field', async () => {
        const obj = new ReadonlyAccessModifiers('readonly-value', 42);
        const result = await agenticPro<string>`Return the publicReadonly property of ${obj}.`();
        expect(result).toBe('readonly-value');
    });

    /**mock
    Accessing private readonly via method.

    ```python
    raise AgentError("Not implemented")
    return obj.getPrivateReadonly()
    ```
    */
    it.fails('should access private readonly via method', async () => {
        const obj = new ReadonlyAccessModifiers('value', 99);
        const result = await agenticPro<number>`Call getPrivateReadonly on ${obj}.`();
        expect(result).toBe(99);
    });
});

class MixedModifiers {
    private data: { value: number }[] = [];

    public addData(value: number): void {
        this.data.push({ value });
    }

    public getData(): { value: number }[] {
        return this.data;
    }

    private processData(): number {
        return this.data.reduce((sum, item) => sum + item.value, 0);
    }

    public getSum(): number {
        return this.processData();
    }
}

describe('Mixed Modifiers Tests', () => {
    /**mock
    Adding data via public method.

    ```python
    raise AgentError("Not implemented")
    return obj.addData(10)
    ```
    */
    it.fails('should add data via public method', async () => {
        const obj = new MixedModifiers();
        await agenticPro<void>`Call addData on ${obj} with 10.`();
        expect(obj.getData().length).toBe(1);
    });

    /**mock
    Getting private data via public.

    ```python
    raise AgentError("Not implemented")
    return obj.getData()
    ```
    */
    it.fails('should get private data via public method', async () => {
        const obj = new MixedModifiers();
        obj.addData(5);
        obj.addData(10);
        const result = await agenticPro<{ value: number }[]>`Call getData on ${obj}.`();
        expect(result).toEqual([{ value: 5 }, { value: 10 }]);
    });

    /**mock
    Calling private processing via public.

    ```python
    raise AgentError("Not implemented")
    return obj.getSum()
    ```
    */
    it.fails('should call private processing method via public method', async () => {
        const obj = new MixedModifiers();
        obj.addData(5);
        obj.addData(10);
        obj.addData(15);
        const result = await agenticPro<number>`Call getSum on ${obj}.`();
        expect(result).toBe(30);
    });
});
