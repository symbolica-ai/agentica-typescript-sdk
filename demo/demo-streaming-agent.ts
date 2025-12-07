import { spawn } from '@agentica/agent';

function exponentiate(a: number, b: number): number {
    return a ** b;
}

function add(a: number, b: number): number {
    return a + b;
}

async function computeExample(): Promise<void> {
    const agent = await spawn({
        premise: 'You are a helpful assistant that explains calculations step by step.',
    });

    const a = 5;
    const b = 3;

    const chunks: string[] = [];
    const firstResult = await agent.call<number>(
        'Explain how to calculate (a ** b) * a * b. Return the result using the exponentiate function.',
        { a, b, exponentiate },
        {
            listener: (iid, chunk) => {
                chunks.push(chunk.content);
                process.stdout.write(chunk.content);
            },
        }
    );

    console.log('\n\nStreamed chunks:', chunks.length);
    console.log('First result:', firstResult);

    const c = 7;
    const chunks2: string[] = [];
    const secondResult = await agent.call<number>(
        'Now explain how to calculate a ** c + 7. Return the result using the exponentiate and add function.',
        { c, add },
        {
            listener: (iid, chunk) => {
                chunks2.push(chunk.content);
                process.stdout.write(chunk.content);
            },
        }
    );

    console.log('\n\nStreamed chunks:', chunks2.length);
    console.log('Second result:', secondResult);

    agent.close();
}

void computeExample();
