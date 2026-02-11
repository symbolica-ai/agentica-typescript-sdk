import { describe, expect, it } from 'vitest';

import { __repr__, __str__ } from './str';

describe('__str__', () => {
    const str = (obj: any, maxDepth?: number) => __str__(obj, maxDepth !== undefined ? { maxDepth } : {});

    // 1. All primitives
    describe('primitives', () => {
        it('null', () => {
            expect(str(null)).toBe('None');
        });

        it('undefined', () => {
            expect(str(undefined)).toBe('None');
        });

        it('true', () => {
            expect(str(true)).toBe('True');
        });

        it('false', () => {
            expect(str(false)).toBe('False');
        });

        it('integer number', () => {
            expect(str(42)).toBe('42');
        });

        it('float number', () => {
            expect(str(3.14)).toBe('3.14');
        });

        it('negative number', () => {
            expect(str(-7)).toBe('-7');
        });

        it('zero', () => {
            expect(str(0)).toBe('0');
        });

        it('NaN', () => {
            expect(str(NaN)).toBe('NaN');
        });

        it('Infinity', () => {
            expect(str(Infinity)).toBe('Infinity');
        });

        it('bigint', () => {
            expect(str(10n ** 100n)).toBe(`1${`0`.repeat(100)}`);
        });

        it('string', () => {
            expect(str('hello')).toBe('hello');
        });

        it('empty string', () => {
            expect(str('')).toBe('');
        });

        it('symbol with description', () => {
            expect(str(Symbol('foo'))).toBe('Symbol(foo)');
        });

        it('symbol without description', () => {
            expect(str(Symbol())).toBe('Symbol()');
        });
    });

    // 2. Errors directly
    describe('errors directly', () => {
        it('Error returns its message when top-level', () => {
            expect(str(new Error('something broke'))).toBe('something broke');
        });

        it('TypeError returns its message when top-level', () => {
            expect(str(new TypeError('bad type'))).toBe('bad type');
        });

        it('RangeError returns its message when top-level', () => {
            expect(str(new RangeError('out of range'))).toBe('out of range');
        });

        it('Error with empty message', () => {
            expect(str(new Error(''))).toBe('');
        });
    });

    // 3. Empty objects and arrays
    describe('empty objects and arrays', () => {
        it('empty array', () => {
            expect(str([])).toBe('[]');
        });

        it('empty object', () => {
            expect(str({})).toBe('Object()');
        });
    });

    // 4. Nested(1) objects and arrays
    describe('nested(1) objects and arrays', () => {
        it('array with primitives', () => {
            expect(str([1, 'two', true, null])).toBe("[1, 'two', True, None]");
        });

        it('object with primitive values', () => {
            expect(str({ a: 1, b: 'hello' })).toBe("Object(a=1, b='hello')");
        });

        it('array containing an object', () => {
            expect(str([{ x: 1 }])).toBe('[Object(x=1)]');
        });

        it('object containing an array', () => {
            expect(str({ items: [1, 2] })).toBe('Object(items=[1, 2])');
        });
    });

    // 5. Object containing an error
    describe('object containing an error', () => {
        it('error nested in object uses dataclass style', () => {
            expect(str({ err: new Error('nested fail') })).toBe('Object(err=Error(nested fail))');
        });

        it('error nested in array uses dataclass style', () => {
            expect(str([new Error('in array')])).toBe('[Error(in array)]');
        });

        it('TypeError nested in object', () => {
            expect(str({ err: new TypeError('type issue') })).toBe('Object(err=TypeError(type issue))');
        });
    });

    // 6. Objects with getters that throw errors
    describe('objects with getters that throw errors', () => {
        it('getter that throws is caught and displayed', () => {
            const obj = Object.create(null, {
                safe: { value: 1, enumerable: true },
                dangerous: {
                    get() {
                        throw new Error('getter exploded');
                    },
                    enumerable: true,
                },
            });
            // Object.create(null) has no constructor, so className falls back to 'Object'
            const result = str(obj);
            expect(result).toContain('safe=1');
            expect(result).toContain('dangerous=<errored(getter exploded)>');
        });

        it('getter throwing non-Error', () => {
            const obj: any = {};
            Object.defineProperty(obj, 'bad', {
                get() {
                    throw new Error('oops');
                },
                enumerable: true,
            });
            expect(str(obj)).toContain('<errored(oops)>');
        });
    });

    // 7. Circular references
    describe('circular references', () => {
        it('object referencing itself', () => {
            const obj: any = { name: 'self' };
            obj.self = obj;
            expect(str(obj)).toBe("Object(name='self', self=<circular Object>)");
        });

        it('array containing itself', () => {
            const arr: any[] = [1];
            arr.push(arr);
            expect(str(arr)).toBe('[1, <circular Array>]');
        });

        it('mutually circular objects', () => {
            const a: any = { id: 'a' };
            const b: any = { id: 'b' };
            a.ref = b;
            b.ref = a;
            const result = str(a);
            expect(result).toBe("Object(id='a', ref=Object(id='b', ref=<circular Object>))");
        });
    });

    // 8. Depth limit exceeded
    describe('depth limit exceeded', () => {
        it('maxDepth=1 stops at first object nesting', () => {
            const obj = { nested: { deep: true } };
            expect(str(obj, 1)).toBe('Object(nested=<depth exceeded Object>)');
        });

        it('maxDepth=1 stops at first array nesting', () => {
            const obj = { arr: [1, 2] };
            expect(str(obj, 1)).toBe('Object(arr=<depth exceeded Array>)');
        });

        it('maxDepth=0 stops immediately for objects', () => {
            expect(str({}, 0)).toBe('<depth exceeded Object>');
        });

        it('maxDepth=0 stops immediately for arrays', () => {
            expect(str([], 0)).toBe('<depth exceeded Array>');
        });

        it('maxDepth=2 allows two levels', () => {
            const obj = { a: { b: { c: 1 } } };
            expect(str(obj, 2)).toBe('Object(a=Object(b=<depth exceeded Object>))');
        });
    });

    // 9. Nested(5) objects and arrays with custom depth limit
    describe('nested(5) with custom depth limit', () => {
        it('deeply nested objects with maxDepth=6', () => {
            const obj = { a: { b: { c: { d: { e: { f: 'deep' } } } } } };
            expect(str(obj, 6)).toBe("Object(a=Object(b=Object(c=Object(d=Object(e=Object(f='deep'))))))");
        });

        it('deeply nested arrays with maxDepth=6', () => {
            const arr = [[[[[['deep']]]]]];
            expect(str(arr, 6)).toBe("[[[[[['deep']]]]]]");
        });

        it('deeply nested objects truncated at maxDepth=3 (default)', () => {
            const obj = { a: { b: { c: { d: 'too deep' } } } };
            expect(str(obj)).toBe('Object(a=Object(b=Object(c=<depth exceeded Object>)))');
        });

        it('mixed nesting with maxDepth=5', () => {
            const obj = { arr: [{ inner: [{ val: 42 }] }] };
            expect(str(obj, 5)).toBe('Object(arr=[Object(inner=[Object(val=42)])])');
        });
    });

    // 10. Objects with class names vs anonymous objects
    describe('objects with class names vs anonymous objects', () => {
        it('plain object uses Object', () => {
            expect(str({ x: 1 })).toBe('Object(x=1)');
        });

        it('class instance uses class name', () => {
            class MyWidget {
                width = 100;
                height = 200;
            }
            expect(str(new MyWidget())).toBe('MyWidget(width=100, height=200)');
        });

        it('class with Symbol.toStringTag uses that tag', () => {
            class Custom {
                value = 1;
                get [Symbol.toStringTag]() {
                    return 'CustomTag';
                }
            }
            expect(str(new Custom())).toBe('CustomTag(value=1)');
        });

        it('nested class instances', () => {
            class Inner {
                val = 99;
            }
            class Outer {
                child = new Inner();
            }
            expect(str(new Outer())).toBe('Outer(child=Inner(val=99))');
        });

        it('Map uses Map as class name', () => {
            // Maps have no enumerable own keys, so they show as empty
            expect(str(new Map())).toBe('Map()');
        });
    });

    // 11. Objects with functions
    describe('objects with functions', () => {
        it('function as top-level value', () => {
            function myFunc() {}
            expect(str(myFunc)).toBe('<function myFunc>');
        });

        it('arrow function', () => {
            const arrowFn = () => {};
            expect(str(arrowFn)).toBe('<function arrowFn>');
        });

        it('anonymous function', () => {
            expect(str(function () {})).toBe('<function >');
        });

        it('object containing a function', () => {
            const obj = { name: 'test', callback: function onDone() {} };
            expect(str(obj)).toBe("Object(name='test', callback=<function onDone>)");
        });

        it('object containing an arrow function', () => {
            const handler = () => {};
            expect(str({ handler })).toBe('Object(handler=<function handler>)');
        });
    });

    // 12. repr mode
    describe('repr mode', () => {
        const repr = (obj: any) => __repr__(obj);

        it('bare string is JSON-escaped with double quotes', () => {
            expect(repr('hello')).toBe('"hello"');
        });

        it('bare string with special characters', () => {
            expect(repr('line1\nline2\t"quoted"')).toBe('"line1\\nline2\\t\\"quoted\\""');
        });

        it('string inside an object is JSON-escaped', () => {
            expect(repr({ msg: 'hi there' })).toBe('Object(msg="hi there")');
        });

        it('string inside a nested object', () => {
            expect(repr({ a: { b: 'val' } })).toBe('Object(a=Object(b="val"))');
        });
    });
});
