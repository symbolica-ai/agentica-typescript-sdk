import { createLogger } from '@logging/index';
import { CompiledConceptContext } from '@transformer/processor/processor-utils';

import {
    AgentInitializationConfig,
    AgentInvocationConfig,
    Chunk,
    MaxTokens,
    ModelStrings,
    ReasoningEffort,
    ServeResponseConfig,
    Usage,
    createAgentEnvironment,
    invokeAgent,
    serveRequestsUntilResult,
    startEchoStream,
} from './common';
import { type Template, maybePromptTemplate } from './template';

// Re-export Usage for convenience
export { Usage } from './common';

export type AgenticContext = {
    concepts: CompiledConceptContext;
    siteId: string;
    siteOutputType: string;
    docString: string;
};

export type AgenticConfig = {
    model?: ModelStrings;
    premise?: string;
    system?: string | Template;
    listener?: (iid: string, chunk: Chunk) => void;
    /** Whether to include usage chunks in the listener stream. Defaults to false. */
    listenerIncludeUsage?: boolean;
    /** Callback to receive usage statistics after the agentic function completes */
    onUsage?: (usage: Usage) => void;
    maxTokens?: MaxTokens | number;
    reasoningEffort?: ReasoningEffort;
    /** Only used for Anthropic models */
    cacheTTL?: '5m' | '1h';
    parentCallId?: string;
};

// System prompt only overload
export async function agentic<T>(
    userPrompt: string,
    scope?: object,
    config?: AgenticConfig & { system: string | Template; premise?: never }
): Promise<T>;
// Premise only overload
export async function agentic<T>(
    userPrompt: string,
    scope?: object,
    config?: AgenticConfig & { system?: never; premise: string }
): Promise<T>;
// No premise or system overload
export async function agentic<T>(
    userPrompt: string,
    scope?: object,
    config?: AgenticConfig & { system?: never; premise?: never }
): Promise<T>;
export async function agentic<T>(userPrompt: string, scope?: object, config?: AgenticConfig): Promise<T> {
    void userPrompt;
    void scope;
    void config;
    throw new Error('Run the transformation before calling agentic');
}

export function agenticPro<T>(
    userPromptParts: TemplateStringsArray,
    ...scope: any[]
): (config?: AgenticConfig) => Promise<T> {
    void userPromptParts;
    void scope;
    throw new Error('Run the transformation before calling agenticPro');
}

export async function agenticTransformation<T = any>(
    ctx: AgenticContext,
    prompt: string,
    config?: AgenticConfig
): Promise<T> {
    const logger = createLogger(`agentica:agentic-${ctx.siteId}`);
    const span = logger.startSpan('agenticTransformation');

    try {
        // Initialize function (ephemeral agent)
        const initConfig: AgentInitializationConfig = {
            premise: config?.premise,
            system: maybePromptTemplate(config?.system),
            persist: false,
            model: config?.model,
            maxTokens: MaxTokens.fromMaxTokens(config?.maxTokens),
            reasoningEffort: config?.reasoningEffort,
            cacheTTL: config?.cacheTTL,
            streaming: !!config?.listener,
            siteId: ctx.siteId,
            /* TODO: concepts should be passed in here to allow scope to
             * be dumped to the system prompt instead, which makes sense for agentica's single-shot nature.
             * but, we prompt agentica functions the same as agents (NOT how we do it in Python),
             * so this style of prompting could be more confusing (esp. with the few-shot examples for OAI models)
             */
            //concepts: ctx.concepts,
        };

        // No globals for agentica functions, so runtime will be empty here
        const { uid, runtime: emptyRuntime, sessionManager } = await createAgentEnvironment(initConfig, logger);
        span.setAttribute('agent_uid', uid);

        // Invoke agent
        const invokeConfig: AgentInvocationConfig = {
            uid,
            concepts: ctx.concepts,
            siteId: ctx.siteId,
            siteOutputType: ctx.siteOutputType,
            prompt: prompt,
            streaming: !!config?.listener,
            parentCallId: config?.parentCallId,
        };

        const { handle, runtime } = await invokeAgent(invokeConfig, logger, sessionManager, emptyRuntime);

        try {
            let cancelStream: AbortController | undefined;
            // If echo callback is provided, iterate over stream and call the callback
            if (config?.listener) {
                cancelStream = new AbortController();
                const echoCallback = config.listener;

                // Start streaming in parallel with serving response
                startEchoStream(sessionManager, cancelStream.signal, uid, handle.iid, echoCallback, logger, config.listenerIncludeUsage ?? false);
            }

            // Serve response
            const serveConfig: ServeResponseConfig = {
                runtime,
                handle,
                siteOutputType: ctx.siteOutputType,
            };
            const result = (await Promise.race([serveRequestsUntilResult(serveConfig, logger), handle.exception])) as T;

            if (cancelStream) {
                cancelStream.abort(); // Cancel the streaming loop after result is returned
            }

            // Fetch and report usage if callback provided
            if (config?.onUsage) {
                try {
                    const { usage } = await sessionManager.fetchUsage(uid, handle.iid);
                    config.onUsage(usage);
                } catch (e) {
                    logger.warn('Failed to fetch usage', e as Error);
                }
            }

            return result;
        } finally {
            // Clean up site resources after streaming completes
            await sessionManager.closeAgent(uid);
        }
    } catch (error) {
        span.recordException(error as Error);
        throw error;
    } finally {
        span.end();
    }
}
