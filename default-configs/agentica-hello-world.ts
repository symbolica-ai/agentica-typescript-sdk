import { agentic } from '@symbolica/agentica';

async function sentimentAnalysis(sentence: string): Promise<'positive' | 'negative' | 'neutral'> {
    return await agentic('Classify sentiment of the sentence.', { sentence });
}

async function main() {
    const result = await sentimentAnalysis('Agentica is an amazing framework!');
    console.log('The sentiment is:', result);
}

main();
