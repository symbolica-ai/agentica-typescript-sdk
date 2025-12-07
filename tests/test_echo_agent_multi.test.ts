import { spawn } from '@agentica/agent';
import { describe, expect, it } from 'vitest';

describe('Multi-Call Agent Streaming', () => {
    it('should stream responses for multiple sequential calls', async () => {
        function log_chunk(chunk_content: string) {
            process.stdout.write(chunk_content);
        }
        const agent = await spawn({
            premise: 'You are a helpful assistant that explains calculations step by step.',
        });

        // First call
        const x = 5;
        const chunks1: string[] = [];
        const finalResult1: string = await agent.call<string>(
            'Explain how to calculate x * 2',
            { x },
            {
                listener: (iid, chunk) => {
                    chunks1.push(chunk.content);
                    log_chunk(chunk.content);
                },
            }
        );

        console.log('\nCall 1 streaming:');

        expect(chunks1.length).toBeGreaterThan(0);
        expect(typeof finalResult1).toBe('string');
        expect(finalResult1).toContain('10');
        console.log(`\nCall 1: ${chunks1.length} chunks, result="${finalResult1}"`);

        // Second call
        const y = 3;
        const chunks2: string[] = [];
        const finalResult2: string = await agent.call<string>(
            'Explain how to calculate y + 7',
            { y },
            {
                listener: (iid, chunk) => {
                    chunks2.push(chunk.content);
                    log_chunk(chunk.content);
                },
            }
        );

        console.log('\nCall 2 streaming:');

        expect(typeof finalResult2).toBe('string');
        expect(finalResult2).toContain('10');
        console.log(`\nCall 2: ${chunks2.length} chunks, result="${finalResult2}"`);

        // Third call
        const a = 2;
        const b = 3;
        const chunks3: string[] = [];
        const finalResult3: string = await agent.call<string>(
            'Explain how to calculate a + b',
            { a, b },
            {
                listener: (iid, chunk) => {
                    chunks3.push(chunk.content);
                    log_chunk(chunk.content);
                },
            }
        );

        console.log('\nCall 3 streaming:');

        expect(chunks3.length).toBeGreaterThan(0);
        expect(typeof finalResult3).toBe('string');
        expect(finalResult3).toContain('5');
        console.log(`\nCall 3: ${chunks3.length} chunks, result="${finalResult3}"`);
    }, 15000);
});

/**mock
Let me explain how to calculate x * 2:

When x is 5, we multiply it by 2. Let me calculate that:

```python
return str(x * 2)
```

The result is 10.
*/

/**mock
Let me explain how to calculate y + 7:

When y is 3, we add 7 to it. Let me calculate that:

```python
return str(y + 7)
```

The result is 10.
*/

/**mock
Let me explain how to calculate a + b:

When a is 2 and b is 3, we add them together. Let me calculate that:

```python
return str(a + b)
```

The result is 5.
*/
