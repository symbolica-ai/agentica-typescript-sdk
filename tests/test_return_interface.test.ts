import { describe, expect, it } from 'vitest';

import { agenticPro } from '../src/agentica/agentic.js';

interface BasicInterface {
    name: string;
    age: number;
}

describe('Basic Interface Tests', () => {
    /**mock
    ```python
    try:
        stub = _emit_stubs({"BasicInterface": BasicInterface})[0]
        return BasicInterface(stub, 2)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('make an instance of an interface', async () => {
        const result = await agenticPro<BasicInterface>`hello`();
        expect(result.age).toBe(2);
        expect(result.name).toBe(`class BasicInterface:
    name: str
    age: int
    def __init__(self, name: str, age: int) -> None:
        """Initialize an instance of BasicInterface."""`);
    });
});

interface InterfaceWithOptional {
    required: string;
    optional?: number;
}

describe('Interface with Optional Properties Tests', () => {
    /**mock
    ```python
    try:
        stub = _emit_stubs({"InterfaceWithOptional": InterfaceWithOptional})[0]
        return InterfaceWithOptional(stub, 2)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('make an instance of an interface', async () => {
        const result = await agenticPro<InterfaceWithOptional>`hello`();
        expect(result.optional).toBe(2);
        expect(result.required).toBe(`class InterfaceWithOptional:
    required: str
    optional: int | None
    def __init__(self, required: str, optional: int | None = ...) -> None:
        """Initialize an instance of InterfaceWithOptional."""`);
    });
});

interface InterfaceWithIndexType {
    [key: number]: string;
    required: string;
    optional?: number;
}

describe('Interface with Optional Properties Tests', () => {
    /**mock
    ```python
    try:
        stub = _emit_stubs({"InterfaceWithIndexType": InterfaceWithIndexType})[0]
        return InterfaceWithIndexType({1: "hello"}, stub)
    except Exception:
        raise AgentError("Test failed")
    ```
    */
    it('make an instance of an interface', async () => {
        const result = await agenticPro<InterfaceWithIndexType>`hello`();
        expect(result.required).toBe(`class InterfaceWithIndexType:
    required: str
    optional: int | None
    def __contains__(self, key: int) -> bool:
        """Objects of this class are dict-like, and support checking for membership with \`key in obj\`."""
    def __delitem__(self, key: int) -> None:
        """Objects of this class are dict-like, and support deletion with \`del obj[key]\`."""
    def __getitem__(self, key: int) -> str:
        """Objects of this class are dict-like, and support indexing with \`obj[key]\`."""
    def __init__(self, index_signature: dict[int, str], required: str, optional: int | None = ...) -> None:
        """Initialize an instance of InterfaceWithIndexType."""
    def __setitem__(self, key: int, value: str) -> None:
        """Objects of this class are dict-like, and support assignment with \`obj[key] = value\`."""`);
        expect(result[1]).toBe('hello');
    });
});

describe('Instantiate incorrectly', () => {
    /**mock
    ```python
    try:
        return InterfaceWithIndexType()
    except Exception as e:
        raise AgentError(str(e))
    ```
    */
    it('should fail with proper error when called with no arguments', async () => {
        try {
            await agenticPro<InterfaceWithIndexType>`hello`();
            expect.fail('Should have thrown an error');
        } catch (error: unknown) {
            expect((error as Error).message).toContain('InterfaceWithIndexType() failed:');
            expect((error as Error).message).toContain('missing required positional arguments');
        }
    });
});

interface WithFoo {
    foo: string;
}

interface WithBar {
    bar: number;
}

type IntersectionType = WithFoo & WithBar;

describe('Intersection Type Tests', () => {
    /**mock
    ```python
    try:
        stub = _emit_stubs({"IntersectionType": IntersectionType})[0]
        print(f"Intersection stub:\\n{stub}")
        return IntersectionType("hello", 42)
        raise AgentError(f"Should not be able to instantiate intersection type, but succeeded")
    except Exception as e:
        raise AgentError(str(e))
    ```
    */
    it('should not allow instantiation of intersection types', async () => {
        try {
            await agenticPro<IntersectionType>`hello`();
            expect.fail('Should have thrown an error about not being able to instantiate intersection type');
        } catch (error: unknown) {
            expect((error as Error).message).toBe('Intersection as return type is Coming Soon in code mode!');
        }
    });
});
