import { describe, expect, it } from 'vitest';

import { agentic } from '../src/agentica/agentic.js';

interface Interface {
    [key: number]: string;
    j?: boolean;
    dog: string;
}

interface Interface2 extends Interface {
    example(k?: boolean): void;
}

// --->

class InterfaceImpl implements Interface2 {
    [key: number]: string;
    j?: boolean;
    dog: string;

    constructor(dog: string = 'cute', j?: boolean) {
        this.dog = dog;
        this.j = j;
    }

    example(k?: boolean) {
        k = k ?? true;
        void k;
    }
}

describe('test anon interfaces', () => {
    it('test synthetic dict protocol', async () => {
        const x: Map<number, string> = new Map();
        x.set(1, 'hello');
        x.set(2, 'world');

        /**mock
        ```python
        try:
            return _emit_stubs({"InterfaceImpl": InterfaceImpl, "x": x, "Interface2": Interface2})[0]
        except Exception:
            raise AgentError("Test failed")
        ```
        */
        const result = await agentic<string>('yes', { x, InterfaceImpl });
        console.log('Running _emit_stubs:');
        console.log(result);
        expect(result).toBe(`class Interface2(Protocol):
    j: bool | None
    dog: str
    def __contains__(self, key: int) -> bool:
        """Objects of this class are dict-like, and support checking for membership with \`key in obj\`."""
    def __delitem__(self, key: int) -> None:
        """Objects of this class are dict-like, and support deletion with \`del obj[key]\`."""
    def __getitem__(self, key: int) -> str:
        """Objects of this class are dict-like, and support indexing with \`obj[key]\`."""
    def __setitem__(self, key: int, value: str) -> None:
        """Objects of this class are dict-like, and support assignment with \`obj[key] = value\`."""
    def example(self, k: bool | None = ...) -> None: ...

class InterfaceImpl(Interface2):
    j: bool | None
    dog: str
    def __contains__(self, key: int) -> bool:
        """Objects of this class are dict-like, and support checking for membership with \`key in obj\`."""
    def __delitem__(self, key: int) -> None:
        """Objects of this class are dict-like, and support deletion with \`del obj[key]\`."""
    def __getitem__(self, key: int) -> str:
        """Objects of this class are dict-like, and support indexing with \`obj[key]\`."""
    def __setitem__(self, key: int, value: str) -> None:
        """Objects of this class are dict-like, and support assignment with \`obj[key] = value\`."""
    def example(self, k: bool | None = ...) -> None: ...

x: dict = {1: 'hello', 2: 'world'}`);
    });

    it('test accessing index signature with concrete class', async () => {
        const z = new InterfaceImpl('very cute', true);
        z[1] = 'hello';
        /**mock
        ```python
        try:
            return z[1]
        except Exception:
            raise AgentError("Test failed")
        ```
        */
        const result2 = await agentic<string>('yes', { z });
        expect(result2).toBe('hello');
    });

    it('test accessing index signature with anonymous interface', async () => {
        const x: { [key: number]: string; dog: string } = { 1: 'hello', 2: 'world', dog: 'very cute' };
        /**mock
        ```python
        try:
            return x[1]
        except Exception:
            raise AgentError("Test failed")
        ```
        */
        const result = await agentic<string>('yes', { x });
        expect(result).toBe('hello');
    });
});
