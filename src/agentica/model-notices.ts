import type { ModelStrings } from './common';

const modelNoticesPrinted = new Set<string>();

const MODEL_NOTICES: Partial<Record<ModelStrings, string>> = {
    'openai:gpt-4o': 'has known task performance issues, consider using a more capable model.',
    'openai:gpt-5':
        'is subject to high latency and low throughput, consider using another model if performance is critical.',
};

export function printModelNotice(model: ModelStrings): void {
    if (process.env.AGENTICA_NO_MODEL_NOTICE) {
        return;
    }

    if (modelNoticesPrinted.has(model)) {
        return;
    }

    modelNoticesPrinted.add(model);

    if (model in MODEL_NOTICES) {
        const suffix = '(set AGENTICA_NO_MODEL_NOTICE to disable this message)';
        console.warn(`${model} ${MODEL_NOTICES[model]} ${suffix}`);
    }
}
