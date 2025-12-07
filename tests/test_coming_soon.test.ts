// PASS: 3
// FAIL: 12

import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

import ComingSoon from '@/coming-soon';

function* generator() {
    yield 1;
    yield 2;
    yield 3;
}

class _CustomError extends Error {
    constructor(message: string) {
        super(message);
    }
}

// Test interfaces that can't be converted to classes (have methods)
interface WithMethod {
    value: number;
    getValue(): number;
}

type ConcreteClass = {
    id: number;
    data: string;
};

type UnionWithInterface = ConcreteClass | WithMethod;
type IntersectionWithInterface = ConcreteClass & WithMethod;

// The following need to fail:
// - [x] generators
// - [x] urls
// - [x] custom exceptions
// - [x] type constructors
// - [x] unsupported builtin classes
// - [x] return types (interfaces)
//   - [x] interface with methods
//   - [x] union containing interface
//   - [x] intersection containing interface
// - [x] file handles

describe('Coming Soon Tests', () => {
    it('should fail with generators', async () => {
        const gen = generator();
        const magicCall = async () => await agentic<number[]>('Return the list of generated values from.', { gen });
        await expect(magicCall).rejects.toThrowError(ComingSoon);
    });

    it('should fail returning an interface with methods', async () => {
        const magicCall = async () => await agentic<WithMethod>('Return an object with value 42.');
        await expect(magicCall).rejects.toThrowError(ComingSoon);
    });

    it('should fail returning a union containing an interface', async () => {
        const magicCall = async () => await agentic<UnionWithInterface>('Return an object with appropriate fields.');
        await expect(magicCall).rejects.toThrowError(ComingSoon);
    });

    it('should fail returning an intersection containing an interface', async () => {
        const magicCall = async () =>
            await agentic<IntersectionWithInterface>('Return an object with all required fields.');
        await expect(magicCall).rejects.toThrowError(ComingSoon);
    });

    // === Following cause COMPILE error as opposed to run-time error ===

    // it('should fail Uint8Array', async () => {
    //     const uint8Array = new Uint8Array(1);
    //     const magicCall = async () => await agentic<number>('Return the first value from.', { uint8Array });
    //     await expect(magicCall).rejects.toThrowError(ComingSoon);
    // });

    // it('should fail with urls', async () => {
    //     const url = new URL('https://www.google.com');
    //     const magicCall = async () => await agentic<string>(`Return the url from ${url}.`);
    //     await expect(magicCall).rejects.toThrowError(ComingSoon);
    // });

    // it('should fail with custom exceptions', async () => {
    //     const magicCall = async () => await agentic<number>(`Raise ${CustomError}.`);
    //     await expect(magicCall).rejects.toThrowError(ComingSoon);
    // });

    // it('should fail Unint32Array', async () => {
    //     const uint32Array = new Uint32Array(1);
    //     const magicCall = async () => await agentic<number>(`Return the first value from ${uint32Array}.`);
    //     await expect(magicCall).rejects.toThrowError(ComingSoon);
    // });

    // it('should fail ArrayBuffer', async () => {
    //     const arrayBuffer = new ArrayBuffer(1);
    //     const magicCall = async () => await agentic<number>(`Return the first value from ${arrayBuffer}.`);
    //     await expect(magicCall).rejects.toThrowError(ComingSoon);
    // });

    // it('should fail file handles', async () => {
    //     const fileHandle = await fsPromises.open('test.txt', 'w');
    //     const magicCall = async () => await agentic<number>(`Return the first value from ${fileHandle}.`);
    //     await expect(magicCall).rejects.toThrowError(ComingSoon);
    // });

    // it('should fail returning Uint8Array', async () => {
    //     const magicCall = async () => await agentic<Uint8Array>(`Return bytes}.`);
    //     await expect(magicCall).rejects.toThrowError(ComingSoon);
    // });
});
