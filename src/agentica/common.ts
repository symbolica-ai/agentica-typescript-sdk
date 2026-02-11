import { getGlobalSessionManager } from '@agentica-client/global-csm';
import { AgentInvocationHandle, ClientSessionManager } from '@client-session-manager/client-session-manager';
import { CreateAgentRequest, PromptTemplate } from '@client-session-manager/types';
import { createLogger } from '@logging/index';
import { CompiledConceptContext } from '@transformer/processor/processor-utils';
import { RPCKind, World } from '@warpc/msg-protocol/kinds';
import { ErrMsg, ResMsg, ResponseMsg } from '@warpc/msg-protocol/rpc/response-msg';
import { RpcMsg } from '@warpc/msg-protocol/rpc/rpc-msg';
import { FrameMuxSocket } from '@warpc/rpc-channel/mux';
import { VirtualSocketForHandle } from '@warpc/rpc-channel/socket';
import { strToBytes } from '@warpc/rpc-channel/utils';
import { FrameRuntime } from '@warpc/runtime';

import { Agentica } from '@/agentica-client';
import { validateFeature, validateReturnType } from '@/coming-soon';
import { ClassMsg } from '@/warpc/msg-protocol/concept/resource/class-msg';

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export type PrimarySupportedModels =
    | 'openai:gpt-3.5-turbo'
    | 'openai:gpt-4o'
    | 'openai:gpt-4.1'
    | 'openai:gpt-5'
    | 'anthropic:claude-sonnet-4'
    | 'anthropic:claude-opus-4.1'
    | 'anthropic:claude-sonnet-4.5';
export type ModelStrings = PrimarySupportedModels | (string & {});
export type Role = 'user' | 'agent' | 'system';

export const DEFAULT_AGENT_MODEL = 'openai:gpt-4.1';

export const DEFAULT_AGENT_MAX_TOKENS_PER_INVOCATION: number | null = null; // unlimited
export const DEFAULT_AGENT_MAX_TOKENS_PER_ROUND: number | null = null; // unlimited
export const DEFAULT_AGENT_MAX_ROUNDS: number | null = null; // unlimited

export interface Chunk {
    role: Role;
    content: string;
}

export function makeRole(role: string, _name?: string): Role {
    switch (role) {
        case 'user':
        case 'agent':
        case 'system':
            return role;
        default:
            throw new Error(`Invalid role: ${role}`);
    }
}

export type AgentInitializationConfig = {
    premise?: string;
    prompt?: string;
    system?: string | PromptTemplate;
    persist?: boolean;
    streaming?: boolean;
    model?: ModelStrings;
    siteId?: string;
    maxTokens?: MaxTokens;
    concepts?: CompiledConceptContext;
    client?: Agentica;
    reasoningEffort?: ReasoningEffort;
    cacheTTL?: '5m' | '1h';
};

export type AgentInvocationConfig = {
    uid: string;
    concepts: CompiledConceptContext;
    siteId: string;
    siteOutputType: string;
    prompt: string | PromptTemplate;
    streaming?: boolean;
    parentCallId?: string;
};

export type InvokeAgentResult = {
    handle: AgentInvocationHandle;
    runtime: FrameRuntime;
};

export type ServeResponseConfig = {
    runtime: FrameRuntime;
    handle: AgentInvocationHandle;
    siteOutputType?: string;
};

function varMapFromRuntimeBuffer(
    runtime: FrameRuntime,
    varMap: Record<string, any>,
    logger: ReturnType<typeof createLogger>,
    location: 'init-time' | 'run-time' = 'run-time'
): Record<string, any> {
    for (const [name, termMsg] of runtime.rootFrame.replBuffer) {
        const refOrVal = termMsg as any;
        const resource = refOrVal.val ?? runtime.rootFrame.context.getResourceFromUID(refOrVal.uid);
        if (resource !== undefined) validateFeature(resource);
        logger.debugObject(`Registering ${location} concept: ${name}`, termMsg);
        varMap[name] = termMsg;
    }
    return varMap;
}

export function prepareRuntimeConcepts(
    concepts: CompiledConceptContext,
    logger: ReturnType<typeof createLogger>,
    existingRuntime?: FrameRuntime
): FrameRuntime {
    logger.debug(`Preparing runtime...`);
    const runtime = existingRuntime ?? new FrameRuntime(World.Client, logger);
    logger.debug(`-> Clearing repl buffer`);
    runtime.rootFrame.resetReplBuffer();
    if (Object.keys(concepts).length > 0) {
        logger.debug(`-> Ingesting ${Object.keys(concepts).length} concept entries into runtime`);
        runtime.rootFrame.ingestLocals(concepts);
    }
    return runtime;
}

export async function createAgentEnvironment(
    config: AgentInitializationConfig,
    logger: ReturnType<typeof createLogger>
): Promise<{ uid: string; runtime: FrameRuntime; sessionManager: ClientSessionManager }> {
    const sessionManager = config.client ? await config.client.createSessionManager() : await getGlobalSessionManager();
    const runtime = prepareRuntimeConcepts(config.concepts ?? {}, logger);
    const varMap = varMapFromRuntimeBuffer(runtime, {}, logger, 'init-time');

    const createAgentReq: CreateAgentRequest = {
        doc: config.premise ?? null,
        system: config.system ?? null,
        warp_globals_payload: new Uint8Array(strToBytes(JSON.stringify(varMap))),
        streaming: config.streaming ?? false,
        model: config.model ?? DEFAULT_AGENT_MODEL,
        max_tokens_per_invocation: config.maxTokens?.perInvocation ?? undefined,
        max_tokens_per_round: config.maxTokens?.perRound ?? undefined,
        max_rounds: config.maxTokens?.rounds ?? undefined,
        reasoning_effort: config.reasoningEffort ?? undefined,
        cache_ttl: config.cacheTTL ?? undefined,
    };

    const uid = await sessionManager.newAgent(createAgentReq, logger);
    runtime.setUid(uid);

    return { uid, runtime, sessionManager };
}

export async function invokeAgent(
    config: AgentInvocationConfig,
    logger: ReturnType<typeof createLogger>,
    sessionManager: ClientSessionManager,
    runtime: FrameRuntime
): Promise<InvokeAgentResult> {
    if (!config.prompt) {
        throw new Error('Prompt is required to invoke an agent');
    }

    // Prepare runtime concepts locally
    runtime = prepareRuntimeConcepts(config.concepts, logger, runtime);

    // Prepare runtime concepts for sending to remote
    let varMap: Record<string, any> = {};
    const outputType = JSON.parse(config.siteOutputType);

    varMap['__return_type'] = runtime.rootFrame.context.getMessageFromUID(outputType.uid);
    logger.debugObject(`Registering Local Warp Var: __return_type`, varMap['__return_type']);
    validateReturnType(varMap['__return_type'], runtime.rootFrame.context); // We don't currently allow returning interfaces

    varMap = varMapFromRuntimeBuffer(runtime, varMap, logger, 'run-time');

    const parentIid = config.parentCallId;
    const parentUid = parentIid ? sessionManager.getUidForIid(parentIid) : undefined;

    // Send agent invocation request
    logger.debug(`Requesting agent invocation from server with parent IID: ${parentIid}, parent UID: ${parentUid}`);
    const handle = await sessionManager.invokeAgent(
        {
            uid: config.uid,
            warpLocalsPayload: strToBytes(JSON.stringify(varMap)),
            taskDesc: config.prompt,
            streaming: config.streaming ?? false,
            parentUid: parentUid ?? undefined,
            parentIid: parentIid ?? undefined,
        },
        logger
    );
    runtime.setIid(handle.iid);

    return { handle, runtime };
}

export async function startEchoStream(
    csm: Awaited<ReturnType<typeof getGlobalSessionManager>>,
    cancelSignal: AbortSignal,
    uid: string,
    iid: string,
    echoCallback: (iid: string, chunk: Chunk) => void,
    logger: ReturnType<typeof createLogger>
): Promise<void> {
    let retryCount = 0;
    while (!cancelSignal.aborted) {
        try {
            const streamIterator = csm.echo(cancelSignal, uid, iid);
            for await (const chunk of streamIterator) {
                echoCallback(iid, chunk);
            }
            break; // Stream completed successfully
        } catch (error) {
            if (cancelSignal.aborted) break;
            retryCount++;
            if (retryCount >= 5) {
                logger.error('Echo stream failed (5 retries)', error as Error);
                throw error;
            }
            logger.warn(`Echo stream error, retrying (${retryCount}/5)...`, error as Error);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
}

export async function serveRequestsUntilResult(
    config: ServeResponseConfig,
    logger: ReturnType<typeof createLogger>
): Promise<any> {
    const { runtime, handle, siteOutputType } = config;

    logger.debug(`Invoked agent, starting RPC service loop`);
    const ws = new VirtualSocketForHandle(handle as AgentInvocationHandle, logger);
    runtime.socket = new FrameMuxSocket(World.Client, ws, logger);
    ws.startReceiving();

    let resultTypeMsg: ClassMsg | undefined = undefined;
    if (siteOutputType) {
        resultTypeMsg = ClassMsg.rehydrate(JSON.parse(siteOutputType));
    }

    try {
        while (true) {
            const response = await runtime.rootFrame.rpcHandler.serveChildOnce(0);
            if (response !== undefined && RPCKind.isResponse((response as RpcMsg).kind)) {
                const responsMsg = response as ResponseMsg;
                if (responsMsg.kind === RPCKind.Response.Res) {
                    const resMsg = responsMsg as ResMsg;
                    runtime.rootFrame.passContextFromRemoteDefs(resMsg.defs ?? []);
                    const result = runtime.rootFrame.conceptDecoder.decodeWithCtx(resMsg.payload.result, resultTypeMsg);
                    logger.info(`Agentica agent call completed successfully`);
                    return result;
                } else if (responsMsg.kind === RPCKind.Response.Err) {
                    const resMsg = responsMsg as ErrMsg;
                    runtime.rootFrame.passContextFromRemoteDefs(resMsg.defs ?? []);
                    const result = runtime.rootFrame.conceptDecoder.decodeWithCtx(resMsg.payload.error);
                    logger.error(`Agentica agent call failed with result:`, result);
                    throw result;
                }
                return;
            }
            logger.debug('Served counter-request');
        }
    } finally {
        logger.debug('Response loop finished.');
        // Socket is now reference counted, it is not our responsibility to close it.
    }
}

/**
 * Control the maximum number of tokens an agent or agentic function can generate.
 *
 * @class MaxTokens
 *
 * @property perInvocation {number | null}  The maximum number of tokens for an invocation (unlimited if null).
 * @property perRound      {number | null}  The maximum number of tokens for a round of inference (unlimited if null).
 * @property rounds        {number | null}  The maximum number of rounds of inference (unlimited if null).
 */
export class MaxTokens {
    constructor(
        public perInvocation: number | null = DEFAULT_AGENT_MAX_TOKENS_PER_INVOCATION,
        public perRound: number | null = DEFAULT_AGENT_MAX_TOKENS_PER_ROUND,
        public rounds: number | null = DEFAULT_AGENT_MAX_ROUNDS
    ) {}

    static from({
        perInvocation,
        perRound,
        rounds,
    }: {
        perInvocation?: number | null;
        perRound?: number | null;
        rounds?: number | null;
    }): MaxTokens {
        if (perInvocation === undefined) perInvocation = DEFAULT_AGENT_MAX_TOKENS_PER_INVOCATION;
        if (perRound === undefined) perRound = DEFAULT_AGENT_MAX_TOKENS_PER_ROUND;
        if (rounds === undefined) rounds = DEFAULT_AGENT_MAX_ROUNDS;
        return new MaxTokens(perInvocation, perRound, rounds);
    }

    static default(): MaxTokens {
        return new MaxTokens();
    }

    /** If the first argument is a `MaxTokens` object, use its values for the other arguments. */
    static fromMaxTokens(
        perInvocation?: MaxTokens | number | null,
        perRound?: number | null,
        rounds?: number | null
    ): MaxTokens {
        if (perInvocation instanceof MaxTokens) {
            const o = perInvocation;
            return new MaxTokens(o.perInvocation, o.perRound, o.rounds);
        }
        const o = MaxTokens.default();
        if (perInvocation !== undefined) {
            o.perInvocation = perInvocation;
        }
        if (perRound !== undefined) {
            o.perRound = perRound;
        }
        if (rounds !== undefined) {
            o.rounds = rounds;
        }
        return o;
    }
}

/**
 * Represents token usage statistics for a model interaction.
 *
 * @class Usage
 * @property inputTokens      The number of tokens consumed by the model.
 * @property outputTokens     The number of tokens generated by the model.
 * @property totalTokens      The total number of tokens processed in the time frame, not
 *                            double-counting generated then re-consumed tokens.
 * @property cachedTokens     The number of input tokens that were served from cache.
 * @property reasoningTokens  The number of tokens used for internal reasoning/chain-of-thought.
 *
 * @remarks
 * Note: `totalTokens` is not always equal to `inputTokens + outputTokens`.
 * It represents the total tokens involved within the timeframe.
 */
export class Usage {
    /**
     * Creates a new Usage instance.
     *
     * @param inputTokens      Number of input tokens.
     * @param outputTokens     Number of output tokens.
     * @param totalTokens      Total tokens processed.
     * @param cachedTokens     Number of input tokens served from cache.
     * @param reasoningTokens  Number of tokens used for reasoning.
     */
    constructor(
        public readonly inputTokens: number,
        public readonly outputTokens: number,
        public readonly totalTokens: number,
        public readonly cachedTokens: number = 0,
        public readonly reasoningTokens: number = 0
    ) {}

    /**
     * Create a Usage from a GenAI usage object (e.g., from a chat-completions API response).
     *
     * @param usage - The raw usage object with prompt_tokens, completion_tokens, total_tokens,
     *                and optional input_tokens_details/output_tokens_details
     * @param lastUsage - The previous cumulative usage (for undoing cumulation)
     */
    static fromCompletions(usage: Record<string, unknown>, lastUsage?: Usage): Usage {
        let inputTokens = (usage.prompt_tokens ?? usage.input_tokens) as number | undefined;
        let outputTokens = (usage.completion_tokens ?? usage.output_tokens) as number | undefined;
        let totalTokens = usage.total_tokens as number | undefined;

        if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) {
            console.warn(`Usage is missing fields: ${JSON.stringify(usage)}`);
        }

        inputTokens = inputTokens ?? 0;
        outputTokens = outputTokens ?? 0;
        totalTokens = totalTokens ?? 0;

        // Extract cached_tokens from input_tokens_details
        let cachedTokens = 0;
        const inputDetails = usage.input_tokens_details as Record<string, number> | undefined;
        if (inputDetails?.cached_tokens !== undefined) {
            cachedTokens = inputDetails.cached_tokens;
        }

        // Extract reasoning_tokens from output_tokens_details
        let reasoningTokens = 0;
        const outputDetails = usage.output_tokens_details as Record<string, number> | undefined;
        if (outputDetails?.reasoning_tokens !== undefined) {
            reasoningTokens = outputDetails.reasoning_tokens;
        }

        if (lastUsage) {
            // input tokens and total tokens are cumulative,
            // so we need to subtract the last usage
            inputTokens -= lastUsage.inputTokens;
            totalTokens -= lastUsage.totalTokens;
            // cached and reasoning tokens are also cumulative
            cachedTokens -= lastUsage.cachedTokens;
            reasoningTokens -= lastUsage.reasoningTokens;
        }

        return new Usage(inputTokens, outputTokens, totalTokens, cachedTokens, reasoningTokens);
    }

    /**
     * Create a new Usage with optionally replaced values.
     */
    replace(other: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        cachedTokens?: number;
        reasoningTokens?: number;
    }): Usage {
        return new Usage(
            other.inputTokens ?? this.inputTokens,
            other.outputTokens ?? this.outputTokens,
            other.totalTokens ?? this.totalTokens,
            other.cachedTokens ?? this.cachedTokens,
            other.reasoningTokens ?? this.reasoningTokens
        );
    }

    /**
     * Add two Usage objects together.
     */
    add(other: Usage): Usage {
        return new Usage(
            this.inputTokens + other.inputTokens,
            this.outputTokens + other.outputTokens,
            this.totalTokens + other.totalTokens,
            this.cachedTokens + other.cachedTokens,
            this.reasoningTokens + other.reasoningTokens
        );
    }

    /**
     * Subtract another Usage from this one.
     */
    sub(other: Usage): Usage {
        return new Usage(
            this.inputTokens - other.inputTokens,
            this.outputTokens - other.outputTokens,
            this.totalTokens - other.totalTokens,
            this.cachedTokens - other.cachedTokens,
            this.reasoningTokens - other.reasoningTokens
        );
    }

    /**
     * Create an empty Usage (all zeros).
     */
    static zero(): Usage {
        return new Usage(0, 0, 0, 0, 0);
    }
}
