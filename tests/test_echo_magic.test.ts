import { agentic } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

describe('Agentic Function Streaming', () => {
    it('should stream explanatory responses', async () => {
        function log_chunk(chunk_content: string) {
            process.stdout.write(chunk_content);
        }
        const a = 5;
        const b = 3;
        const chunks: string[] = [];

        const finalResult: string = await agentic(
            'Explain how to calculate a + b * 2 step by step',
            { a, b },
            {
                listener: (iid, chunk) => {
                    chunks.push(chunk.content);
                    log_chunk(chunk.content);
                },
            }
        );

        console.log('\nAgentic function streaming:');

        expect(chunks.length).toBeGreaterThan(0);
        expect(typeof finalResult).toBe('string');
        expect(finalResult).toContain('11');

        console.log(`\nStreamed ${chunks.length} chunks, result="${finalResult}"`);
    }, 10000);
});

/**mock
Let me explain how to calculate a + b * 2:

Following the order of operations (PEMDAS/BODMAS), we multiply first then add. Let me calculate:

```python
return str(a + b * 2)
```

This gives us 5 + (3 * 2) = 5 + 6 = 11.
*/
