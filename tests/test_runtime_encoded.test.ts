import { spawn } from '@agentica/agent';
import { describe, expect, it } from 'vitest';

const my_obj = {
    x: {
        y: {
            z: {
                f(_a: number, _b: string) {
                    return 982;
                },
                g(_a: number, _b: string): any {
                    return new MyClass() as unknown;
                },
            },
        },
    },
};

class MyClass {
    constructor(public readonly x: number = 10) {}
    f(_a: number, _b: string) {
        return 3227 * this.x;
    }
}

describe('Runtime encoded', () => {
    /**mock
    Ha.

    ```python
    print(id(my_obj.x.y.z.__class__.__bases__[0]))
    print(id(object))
    ```
    */

    /**mock
    Let me return the result of calling f with 1 and "hello".

    ```python
    print(inspect.signature(my_obj.x.y.z.f))
    return my_obj.x.y.z.f(1, "hello")
    ```
    */
    it('should encode a function at runtime', async () => {
        const agent = await spawn({});

        const result = await agent.call<number>('Interact with f', {
            my_obj,
        });
        expect(result).toBe(982);
        await agent.close();
    }, 30_000);

    /**mock
    Getting both instances.

    ```python
    runtime_inst = get_runtime_class_inst()
    show_definition(type(runtime_inst))
    print('runtime_inst', runtime_inst)
    print('type(runtime_inst)', type(runtime_inst))
    show_definition(runtime_inst.f.__func__)
    print(inspect.signature(runtime_inst.f))
    return runtime_inst.f(1, "hello")
    ```
    */
    it('should encode a class at runtime', async () => {
        const agent = await spawn({});

        const result = await agent.call<number>('Interact with f', {
            get_runtime_class_inst: () => new MyClass() as unknown as any,
        });
        expect(result).toBe(32270);
        await agent.close();
    });
});
