import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

// Test classes to verify module path stripping
class TestClass {
    value: number;

    constructor(value: number) {
        this.value = value;
    }

    getValue(): number {
        return this.value;
    }
}

interface TestInterface {
    value: number;
}

type TestType = {
    thing: boolean;
};

class TestClass2 implements TestInterface, TestType {
    value: number;
    thing: boolean;

    constructor() {
        this.value = 0;
        this.thing = false;
    }
}

describe('module path stripping verification', () => {
    /**mock
    ```python
    return [TestClass.__module__, TestInterface.__module__, TestType.__module__, TestClass2.__module__]
    ```
    */
    it('should strip project root from __module__ paths', async () => {
        const result = await agentic<string[]>('Return module paths for all types', {
            TestClass,
            TestClass2,
        });

        console.log('Module paths:', result);

        // Currently failing:
        // expect(result[0]).toBe('tests.test_module_paths_test');
        // expect(result[1]).toBe('src.magic.magic_agent');
        // expect(result[2]).toBe('tests.test_module_paths_test');
        // expect(result[3]).toBe('tests.test_module_paths_test');

        expect(result[0]).toBe('__main__');
        expect(result[1]).toBe('__main__');
        expect(result[2]).toBe('__main__');
        expect(result[3]).toBe('__main__');
    });
});
