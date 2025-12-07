import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

const $foo = {
    $call: ($bar: string) => {
        console.log('this is log:', $bar);
        return $bar + 'baz';
    },
};

describe('a special test for special names', () => {
    /**mock
    Let me fiddle around with the fiddler, and good things will happen!

    ```python
    return Dollar_foo.Dollar_call(bar)
    ```
    */
    it('should be special', async () => {
        const result = await agentic<string>('Be especially special.', { $foo, bar: 'bar' });

        expect(result).toBeDefined();
    });
});

class Quiver {
    arrows: number;
    #secretArrows: number;

    constructor() {
        this.arrows = 27;
        this.#secretArrows = 10;
    }

    get secretArrows() {
        return this.#secretArrows;
    }

    shootArrow() {
        this.arrows--;
    }

    // eslint-disable-next-line no-unused-private-class-members
    #shootSecretArrow() {
        this.#secretArrows--;
    }
}

describe('test private methods', () => {
    /**mock
    Let me shoot the baddies.

    ```python
    assert "#secretArrows" not in quiver.__dict__, "secretArrows should be private"
    assert "#shootSecretArrow" not in quiver.__dict__, "shootSecretArrow should be private"
    return quiver.secretArrows
    ```
    */
    it('private should be special', async () => {
        const quiver = new Quiver();
        const result = await agentic<number>('Be especially special.', { quiver });

        expect(result).toBe(10);
    });
});
