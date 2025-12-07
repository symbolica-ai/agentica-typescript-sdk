import { agentic } from '@agentica/agentic';
import { setDefaultLogLevel } from '@logging/index';

setDefaultLogLevel('silent');

/**
 * Calculates the result of raising a base number to an exponent.
 * @param base The base number
 * @param exponent The exponent to raise the base to
 * @returns The result of base^exponent
 */
async function exponentiate(base: number, exponent: number) {
    return base ** exponent;
}

/**
 * A sub-agent that can perform mathematical calculations using the exponentiate function.
 * @param task A description of the mathematical task to perform
 * @returns The numerical result of the calculation
 */
async function subAgent(task: string): Promise<number> {
    return await agentic<number>(task, { exponentiate });
}

async function calculate(): Promise<void> {
    const result = await agentic<number>('Calculate 3^3 + 4^4 by using sub-agents.', { subAgent });
    console.log('Result: ', result);
}

void calculate();
