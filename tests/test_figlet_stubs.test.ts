import { agentic } from '@agentica/agentic';
import figlet from 'figlet';
import { describe, expect, it } from 'vitest';

describe('Figlet Demo', () => {
    it('should return stubs for all context', async () => {
        /**mock
        ```python
        return _emit_stubs({'figletText': figletText, 'name': name})[0]
        ```
        */
        const name = 'agentica';
        const stubs: string = await agentic('hello', { figletText: figlet.text, name });
        console.log('Figlet stubs:', stubs);
        expect(stubs).toContain(
            'def figletText(text: str, optionsOrFontOrCallback: FigletOptions | str | FunctionType_'
        );
        expect(stubs).toContain(`name: str = 'agentica'`);
    });

    it('return type does not have a promise', async () => {
        /**mock
        ```python
        return str(__return_type)
        ```
        */
        const name = 'agentica';
        const returnTypeString: string = await agentic('hello', { figletText: figlet.text, name });
        console.log('Figlet return type string:', returnTypeString);
        expect(returnTypeString).toBe(`<class 'str'>`);
    });
});
