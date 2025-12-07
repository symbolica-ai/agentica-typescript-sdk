import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

class Xyz {
    x: string | number | boolean;
    y?: string;
    z: boolean | number | string | null;
    abc: Abc;
    abc2: Abc | undefined;

    constructor(
        x: string | number | boolean,
        z: boolean | number | string | null,
        abc: Abc,
        abc2: Abc | undefined,
        y?: string
    ) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.abc = abc;
        this.abc2 = abc2;
    }
}

class Abc {
    a: string;
    b: number;
    c: boolean;
    d: null;
    e: undefined;

    constructor(a: string, b: number, c: boolean, d: null, e: undefined) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
    }
}

const abc = new Abc('hello', 123, true, null, undefined);
const xyz = new Xyz('hello', true, abc, undefined, 'world');

describe('Stubs Test', () => {
    /**mock
    I'll print the stubs for Xyz, Abc, xyz, and abc.
    ```python
    return '\n\n'.join([format_definition(Xyz), format_definition(Abc), format_definition(xyz), format_definition(abc)])
    ```
     */
    it('should print unions in correct order', async () => {
        const result: string = await agentic('Return the stubs for the Xyz class', { Xyz, Abc, xyz, abc });
        console.log('result:', result);
        expect(result).toBeDefined();
        expect(result).toContain('class Xyz');
        expect(result).toContain('    x: bool | str | int');
        expect(result).toContain('    y: str | None');
        expect(result).toContain('    z: bool | int | str | None');
        expect(result).toContain('    abc: Abc');
        expect(result).toContain('    abc2: Abc | None');
        expect(result).toContain(
            '    def __init__(self, x: bool | str | int, z: bool | int | str | None, abc: Abc, abc2: Abc | None, y: str | None = ...) -> None:'
        );
        expect(result).toContain(
            "_: Xyz = Xyz(x='hello', y='world', z=True, abc=Abc(a='hello', b=123, c=True, d=None, e=None), abc2=None)"
        );
        expect(result).toContain("_: Abc = Abc(a='hello', b=123, c=True, d=None, e=None)");
    });

    /**mock
    I'll show the stubs for Xxx, Aaa, xxx, and aaa.
    ```python
    return '\n\n'.join([format_definition(Xxx), format_definition(Aaa), format_definition(xxx), format_definition(aaa)])
    ```
     */
    it('should rename Xyz to Xxx', async () => {
        const result: string = await agentic('Return stubs for the Xxx class', {
            Aaa: Abc,
            Xxx: Xyz,
            xxx: xyz,
            aaa: abc,
        });
        console.log('result:', result);
        expect(result).toBeDefined();
        expect(result).toContain('class Xxx');
        expect(result).toContain('x: bool | str | int');
        expect(result).toContain('y: str | None');
        expect(result).toContain('z: bool | int | str | None');
        expect(result).toContain('abc: Aaa');
        expect(result).toContain('abc2: Aaa | None');
        expect(result).toContain(
            "_: Xxx = Xxx(x='hello', y='world', z=True, abc=Aaa(a='hello', b=123, c=True, d=None, e=None), abc2=None)"
        );
        expect(result).toContain("_: Aaa = Aaa(a='hello', b=123, c=True, d=None, e=None)");
    });

    /**mock
    I'll show the stubs for arrowFunction, renamedFunction, and anonymousFunction.
    ```python
    return (
        '\n\n'.join([format_definition(arrowFunction), format_definition(renamedFunction), format_definition(anonymousFunction)])
        + '\n'
        + f"\nTEST: arrowFunction(1) -> {arrowFunction(1)}"
        + f"\nTEST: renamedFunction(1) -> {renamedFunction(1)}"
        + f"\nTEST: anonymousFunction(1) -> {anonymousFunction(1)}"
    )
    ```
     */
    it('should rename (arrow) functions passed as expressions', async () => {
        const result: string = await agentic(
            'Return stubs for the arrowFunction, renamedFunction, and anonymousFunction',
            {
                arrowFunction: (a: number) => a + 1,
                renamedFunction: function myFunction(a: number) {
                    return a + 2;
                },
                anonymousFunction: function (a: number) {
                    return a + 3;
                },
            }
        );
        console.log('result:', result);
        expect(result).toBeDefined();
        expect(result).toContain('def arrowFunction(a: int) -> int: ...');
        expect(result).toContain('def renamedFunction(a: int) -> int: ...');
        expect(result).toContain('def anonymousFunction(a: int) -> int: ...');
        expect(result).toContain('TEST: arrowFunction(1) -> 2');
        expect(result).toContain('TEST: renamedFunction(1) -> 3');
        expect(result).toContain('TEST: anonymousFunction(1) -> 4');
    });
});
