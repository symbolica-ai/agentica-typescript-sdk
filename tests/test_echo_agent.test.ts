import { spawn } from '@agentica/agent';
import { describe, expect, it } from 'vitest';

describe('Echo Demo', () => {
    it('should stream agent responses', async () => {
        const agent = await spawn({
            premise: 'You are a helpful assistant that counts and explains your thinking step by step.',
        });
        const arg = 0;

        const chunks: string[] = [];
        const finalResult: string = await agent.call<string>(
            'Count to 3 and explain each step',
            { arg },
            {
                listener: (iid, chunk) => {
                    chunks.push(chunk.content);
                    process.stdout.write(chunk.content);
                },
            }
        );

        console.log('\nStreaming response:');

        // Verify we got some streaming content
        expect(chunks.length).toBeGreaterThan(0);

        // Verify the final result
        expect(typeof finalResult).toBe('string');
        expect(finalResult.length).toBeGreaterThan(0);

        console.log(`\nStreamed ${chunks.length} chunks, final result: "${finalResult}"`);
    });
});

/**mock
Let me count to 3 for you:

1. First, we have one
2. Second, we have two
3. Third, we have three

That's counting to 3!
*/
