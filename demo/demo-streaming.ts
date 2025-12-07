// Import from index to ensure OTel initialization happens
import '@/index';
import { agentic } from '@agentica/agentic';

function exponentiate(a: number, b: number): number {
    return a ** b;
}

/**
 * Uses the Slack API to send the user a direct message. Light and cheerful!
 * @param userName The name of the user to send a morning message to
 */
async function computeExample(): Promise<void> {
    const a = 5;
    const b = 3;

    const chunks: string[] = [];
    const result = await agentic<number>(
        'Explain how to calculate (a ** b) * a * b. Return the result of the calculation using the exponentiate function.',
        { a, b, exponentiate },
        {
            listener: (iid: string, chunk: any) => {
                chunks.push(chunk.content);
                process.stdout.write(chunk.content);
            },
        }
    );

    console.log('\n\nStreamed chunks:', chunks.length);
    console.log('Final result:', result);
}

// Execute the function
void computeExample();
