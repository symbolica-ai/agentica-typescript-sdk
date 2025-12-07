import { Agent, spawn } from '@agentica/agent';

export type AgentRole =
    | 'Philosopher'
    | 'DevilAdvocate'
    | 'Moderator'
    | 'FactChecker'
    | 'Contextualizer'
    | 'Arbiter'
    | 'Mediator'
    | 'SelfReflector';

export interface DebateInput {
    text: string;
    topic?: string;
    tone?: string;
}

export interface AgentNode {
    id: string;
    role: AgentRole;
    parentId?: string;
    children: string[];
    stance: string;
    belief: string;
    confidence: number; // 0..1
    status: 'active' | 'resolved' | 'conflicted' | 'terminated';
    numSubagents: number;
    influence: number; // how many agents they affected
    accuracyChecks: { total: number; correct: number };
}

export interface TranscriptEvent {
    id: string; // agent id
    role: AgentRole;
    parentId?: string;
    type: 'message' | 'spawn' | 'terminate' | 'belief_update' | 'contradiction_flag' | 'system';
    content: string;
    at: number;
}

export interface DebateOutcome {
    finalSummary: string;
    agentTree: AgentNode[];
    scorecard: Array<{
        id: string;
        role: AgentRole;
        influence: number;
        accuracyScore: number; // 0..1
        confidenceDelta: number;
        numSubagents: number;
        finalConfidence: number;
    }>;
    transcript: TranscriptEvent[];
}

class DebateAgent {
    id: string;
    role: AgentRole;
    stance: string;
    belief: string;
    confidence: number;
    private agent: Agent | null = null;
    onChunk?: (chunk: string) => void;

    constructor(id: string, role: AgentRole, stance: string, belief: string, confidence: number) {
        this.id = id;
        this.role = role;
        this.stance = stance;
        this.belief = belief;
        this.confidence = confidence;
    }

    async initialize(input: DebateInput): Promise<void> {
        const systemPrompt = buildPremiseForRole(this.role, input);
        // Use system instead of premise since no tools are provided
        this.agent = await spawn({ system: systemPrompt, model: 'anthropic:claude-sonnet-4.5' });
    }

    async say(prompt: string, timeoutMs?: number): Promise<string> {
        if (!this.agent) throw new Error(`${this.role} ${this.id} not initialized`);
        const localAgent = this.agent;
        const callPromise = localAgent.call<string>(
            prompt,
            {},
            {
                listener: (_iid, chunk) => {
                    if (this.onChunk && chunk.content && chunk.role === 'agent') {
                        this.onChunk(chunk.content);
                    }
                },
            }
        );
        if (!timeoutMs || timeoutMs <= 0) {
            const result = await callPromise;
            return result as string;
        }
        const timeoutPromise = new Promise<string>((resolve) => {
            setTimeout(() => resolve('[TIMEOUT] Response took too long; continue.'), timeoutMs);
        });
        const result = await Promise.race([callPromise as Promise<string>, timeoutPromise]);
        return result as string;
    }

    async close(): Promise<void> {
        if (this.agent) await this.agent.close();
    }
}

function buildPremiseForRole(role: AgentRole, input: DebateInput): string {
    const base = `You are ${role} in a formal debate. Debate the following input. Maintain your stance, justify with reasoning, and adapt confidence as you learn: "${input.text}"`;
    const meta = [input.topic ? `Topic: ${input.topic}` : '', input.tone ? `Desired tone: ${input.tone}` : '']
        .filter(Boolean)
        .join('\n');
    switch (role) {
        case 'Philosopher':
            return `${base}\nRole notes: Do abstract and ethical analysis, clarify principles. ${meta}`;
        case 'DevilAdvocate':
            return `${base}\nRole notes: Argue contrarian/extreme positions to stress test claims. ${meta}`;
        case 'Moderator':
            return `${base}\nRole notes: Ensure structure, fairness; flag fallacies and contradictions; decide when to end. ${meta}`;
        case 'FactChecker':
            return `${base}\nRole notes: Verify factual claims using reliable sources or reasoning; return concise verdicts.`;
        case 'Contextualizer':
            return `${base}\nRole notes: Clarify ambiguous terms and provide definitions with context.`;
        case 'Arbiter':
            return `${base}\nRole notes: Resolve contradictions between agents using logic and evidence.`;
        case 'Mediator':
            return `${base}\nRole notes: Unstick stalled debates by reframing or proposing synthesis.`;
        case 'SelfReflector':
            return `${base}\nRole notes: Help the parent agent reconsider assumptions and adjust belief/confidence.`;
        default:
            return base;
    }
}

function defaultInitials(role: AgentRole): { stance: string; belief: string; confidence: number } {
    if (role === 'Moderator')
        return { stance: 'Neutral facilitator', belief: 'Keep debate fair and productive', confidence: 0.9 };
    if (role === 'DevilAdvocate')
        return { stance: 'Contrarian', belief: 'Challenge dominant narrative', confidence: 0.7 };
    return { stance: 'Principled analysis', belief: 'Seek coherent ethical position', confidence: 0.7 };
}

function categorizeForSubagents(message: string, lastMessages: string[]): Array<AgentRole> {
    const roles: AgentRole[] = [];
    const lower = message.toLowerCase();
    const ambiguousTerms = ['freedom', 'intelligence', 'fair', 'efficient', 'harm', 'benefit'];
    const hasAmbiguity = ambiguousTerms.some((t) => lower.includes(t));
    const hasNumbers = /\b\d{2,4}\b/.test(message) || /%/.test(message);
    const uncertainty = /not sure|uncertain|i think|perhaps|maybe|unclear/i.test(message);
    if (hasNumbers || /according to|study|report|data|evidence/i.test(message)) roles.push('FactChecker');
    if (hasAmbiguity) roles.push('Contextualizer');
    if (uncertainty) roles.push('SelfReflector');
    // crude contradiction detection: compare against lastMessages
    const contradiction = lastMessages.some(
        (m) => similarity(m, message) < 0.2 && m.length > 20 && message.length > 20
    );
    if (contradiction) roles.push('Arbiter');
    return roles;
}

function similarity(a: string, b: string): number {
    const sa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const sb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const inter = Array.from(sa).filter((w) => sb.has(w)).length;
    const union = new Set([...Array.from(sa), ...Array.from(sb)]).size || 1;
    return inter / union;
}

export class DebateManager {
    private agents: Map<string, DebateAgent> = new Map();
    private nodes: Map<string, AgentNode> = new Map();
    private transcript: TranscriptEvent[] = [];
    private confidenceStart: Map<string, number> = new Map();

    // UI callbacks
    onAgentSpawned?: (id: string, role: AgentRole, parentId?: string) => void;
    onAgentMessageChunk?: (id: string, chunk: string) => void;
    onAgentMessageComplete?: (id: string, message: string) => void;
    onAgentUpdated?: (node: AgentNode) => void;
    onTreeUpdated?: (tree: AgentNode[]) => void;
    onTranscript?: (event: TranscriptEvent) => void;
    onDebateComplete?: (outcome: DebateOutcome) => void;

    async debate(input: DebateInput, opts?: { maxRounds?: number }): Promise<DebateOutcome> {
        const maxRounds = opts?.maxRounds ?? 4;
        // 1) spawn primary agents
        const primaryRoles: AgentRole[] = ['Philosopher', 'DevilAdvocate', 'Moderator'];
        const primaries = await Promise.all(
            primaryRoles.map(async (role, index) => {
                const id = `${role}_${index}`;
                const init = defaultInitials(role);
                const agent = new DebateAgent(id, role, init.stance, init.belief, init.confidence);
                agent.onChunk = (c) => this.emitChunk(id, c);
                await agent.initialize(input);
                this.registerNode(agent);
                return agent;
            })
        );

        // Initial stances announcement (non-streaming)
        await Promise.all(
            primaries.map(async (agent) => {
                this.emitSpawn(agent.id, agent.role, undefined);
                const stanceMsg = `${agent.role} stance: ${agent.stance}. Belief: ${agent.belief}. Confidence: ${(agent.confidence * 100).toFixed(0)}%.`;
                this.pushTranscript({
                    id: agent.id,
                    role: agent.role,
                    type: 'system',
                    content: stanceMsg,
                    at: Date.now(),
                });
            })
        );

        const moderator = primaries.find((a) => a.role === 'Moderator')!;
        const debaters = primaries.filter((a) => a.role !== 'Moderator');

        // Keep last messages for contradiction checks
        const lastMessages: string[] = [];
        let lastModeratorMsg = '';

        // Initial seeding: spawn subagents if input warrants
        const seedNeeded = categorizeForSubagents(input.text, []);
        for (const role of seedNeeded) {
            // attach to Philosopher for context, or DevilAdvocate for fact-checking
            const parent =
                role === 'FactChecker'
                    ? debaters.find((d) => d.role === 'DevilAdvocate')!
                    : debaters.find((d) => d.role === 'Philosopher')!;
            await this.spawnSubagent(role, parent, input, input.text);
        }

        for (let round = 1; round <= maxRounds; round++) {
            let spawnedThisRound = 0;
            const roundMessages: Record<string, string> = {};
            // Each debater speaks once per round
            for (const debater of debaters) {
                const prompt = this.buildDebateTurnPrompt(debater, input, lastMessages, round);
                const full = await debater.say(prompt, 30000);
                this.emitMessageComplete(debater.id, full);
                lastMessages.push(full);
                roundMessages[debater.id] = full;

                // Categorize and spawn subagents as needed
                const needed = categorizeForSubagents(full, lastMessages.slice(-2));
                for (const role of needed) {
                    await this.spawnSubagent(role, debater, input, full);
                    spawnedThisRound++;
                }
            }

            // Moderator review
            const modPrompt = this.buildModeratorPrompt(moderator, input, lastMessages, round, maxRounds);
            const modMsg = await moderator.say(modPrompt, 20000);
            this.emitMessageComplete(moderator.id, modMsg);
            lastMessages.push(modMsg);
            // Track moderator message for stall detection
            const modSame =
                similarity(modMsg, lastModeratorMsg) > 0.8 && modMsg.length > 20 && lastModeratorMsg.length > 20;
            lastModeratorMsg = modMsg;

            // Simple termination: moderator signals convergence
            if (/\b(conclude|concluded|conclusion|converged|consensus|sufficient)\b/i.test(modMsg)) break;

            // Cross-agent contradiction check per round
            if (debaters.length >= 2) {
                const a = roundMessages[debaters[0].id];
                const b = roundMessages[debaters[1].id];
                if (a && b) {
                    const sim = similarity(a, b);
                    if (sim < 0.25 && a.length > 40 && b.length > 40) {
                        await this.spawnSubagent('Arbiter', moderator, input, `A: ${a}\nB: ${b}`);
                        spawnedThisRound++;
                    }
                }
            }

            // If stall detected and no subagents, spawn Mediator under Moderator
            if (round >= 3 && spawnedThisRound === 0 && modSame) {
                await this.spawnSubagent('Mediator', moderator, input, 'Debate appears stalled. Propose synthesis.');
            }
        }

        // Mark statuses and produce outcome
        for (const node of this.nodes.values()) {
            if (node.role === 'Moderator') node.status = 'resolved';
            else if (node.status === 'active') node.status = 'resolved';
            this.onAgentUpdated?.(node);
        }
        this.emitTree();

        const finalSummary = await moderator.say(
            `Write a concise position-paper style summary of the debate with: Core claims; Agreements/Disagreements; Final positions per agent; Resolved contradictions. Use 6-10 bullet points. End with a one-line bottom-line up front.`
        );

        const outcome = this.buildOutcome(finalSummary);
        this.onDebateComplete?.(outcome);
        return outcome;
    }

    private buildDebateTurnPrompt(agent: DebateAgent, input: DebateInput, last: string[], round: number): string {
        const history = last
            .slice(-6)
            .map((m, i) => `H${i + 1}: ${m}`)
            .join('\n');
        return `Round ${round}. Speak 2-3 sentences. Uphold stance: ${agent.stance}. Current belief: ${agent.belief} (confidence ${(agent.confidence * 100).toFixed(0)}%).\nDebate input: "${input.text}"${input.topic ? `\nTopic: ${input.topic}` : ''}${input.tone ? `\nTone: ${input.tone}` : ''}\nRecent history:\n${history}\nEnd with a one-line self-assessed belief+confidence update in the form: UPDATE: belief=..., confidence=0.xx`;
    }

    private buildModeratorPrompt(
        agent: DebateAgent,
        input: DebateInput,
        last: string[],
        round: number,
        _maxRounds: number
    ): string {
        const history = last
            .slice(-8)
            .map((m, i) => `H${i + 1}: ${m}`)
            .join('\n');
        return (
            `As Moderator, summarize round ${round} briefly, flag fallacies, contradictions, and suggest next steps. If debate appears converged or stalled, state "CONCLUDE: converged". Otherwise state "CONTINUE".` +
            `\nHistory:\n${history}`
        );
    }

    private async spawnSubagent(
        role: AgentRole,
        parent: DebateAgent,
        input: DebateInput,
        parentMsg: string
    ): Promise<void> {
        const id = `${role}_${parent.id}_${Date.now()}`;
        const init = defaultInitials(role);
        const sub = new DebateAgent(id, role, init.stance, init.belief, init.confidence);
        sub.onChunk = (c) => this.emitChunk(id, c);
        await sub.initialize(input);
        this.registerNode(sub, parent.id);
        this.emitSpawn(id, role, parent.id);

        let instruction = '';
        if (role === 'FactChecker')
            instruction = `Fact-check the following claim(s) from parent. Return VERDICT: true/false/uncertain with 1-2 reasons. Parent message: ${parentMsg}`;
        else if (role === 'Contextualizer')
            instruction = `Identify and define ambiguous terms in the parent's message. Return concise definitions and their implications.`;
        else if (role === 'Arbiter')
            instruction = `Two agents appear to contradict each other. Reconcile by stating which claim is better supported and why.`;
        else if (role === 'Mediator')
            instruction = `Debate is stalled. Reframe and propose a synthesis direction in 2 sentences.`;
        else if (role === 'SelfReflector')
            instruction = `Provide a short reflection helping the parent reassess and, if warranted, adjust belief and confidence.`;

        const full = await sub.say(instruction);
        this.emitMessageComplete(id, full);

        // Update parent belief/confidence heuristically
        const parentNode = this.nodes.get(parent.id)!;
        const before = parentNode.confidence;
        if (role === 'FactChecker') {
            parentNode.accuracyChecks.total += 1;
            const correct = /\b(true|supported)\b/i.test(full) && !/uncertain/i.test(full);
            if (correct) parentNode.accuracyChecks.correct += 1;
            parentNode.confidence = clamp(parentNode.confidence + (correct ? 0.05 : -0.07));
        } else if (role === 'SelfReflector') {
            parentNode.confidence = clamp(parentNode.confidence - 0.03);
        } else if (role === 'Mediator' || role === 'Arbiter' || role === 'Contextualizer') {
            parentNode.confidence = clamp(parentNode.confidence + 0.02);
        }
        // Try to extract updated belief
        const updateMatch = full.match(/UPDATE\s*:\s*belief\s*=\s*(.*?),\s*confidence\s*=\s*(0?\.\d+|1(?:\.0+)?)/i);
        if (updateMatch) {
            parentNode.belief = updateMatch[1].trim();
            parentNode.confidence = clamp(parseFloat(updateMatch[2]));
        }
        parentNode.numSubagents += 1;
        parentNode.influence += 1;
        this.onAgentUpdated?.(parentNode);
        this.emitTree();

        // terminate subagent
        await sub.close();
        const subNode = this.nodes.get(id)!;
        subNode.status = 'terminated';
        this.onAgentUpdated?.(subNode);
        this.emitTerminate(id);
        this.emitTree();

        // influence delta record
        const delta = parentNode.confidence - before;
        this.confidenceStart.set(parent.id, this.confidenceStart.get(parent.id) ?? parentNode.confidence - delta);
    }

    private registerNode(agent: DebateAgent, parentId?: string): void {
        const node: AgentNode = {
            id: agent.id,
            role: agent.role,
            parentId,
            children: [],
            stance: agent.stance,
            belief: agent.belief,
            confidence: agent.confidence,
            status: 'active',
            numSubagents: 0,
            influence: 0,
            accuracyChecks: { total: 0, correct: 0 },
        };
        this.nodes.set(agent.id, node);
        if (parentId) {
            const parent = this.nodes.get(parentId);
            if (parent) parent.children.push(agent.id);
        }
        this.onAgentUpdated?.(node);
        this.emitTree();
        this.confidenceStart.set(agent.id, agent.confidence);
        this.agents.set(agent.id, agent);
    }

    private emitChunk(id: string, content: string) {
        const node = this.nodes.get(id);
        this.onAgentMessageChunk?.(id, content);
        this.pushTranscript({ id, role: node ? node.role : 'Moderator', type: 'message', content, at: Date.now() });
    }

    private emitMessageComplete(id: string, content: string) {
        const node = this.nodes.get(id);
        this.onAgentMessageComplete?.(id, content);
        this.pushTranscript({ id, role: node ? node.role : 'Moderator', type: 'message', content, at: Date.now() });
        // Belief/confidence update if provided inline by the agent
        const updateMatch = content.match(/UPDATE\s*:\s*belief\s*=\s*(.*?),\s*confidence\s*=\s*(0?\.\d+|1(?:\.0+)?)/i);
        if (node && updateMatch) {
            node.belief = updateMatch[1].trim();
            node.confidence = clamp(parseFloat(updateMatch[2]));
            this.onAgentUpdated?.(node);
            this.emitTree();
            this.pushTranscript({
                id,
                role: node.role,
                type: 'belief_update',
                content: `belief=${node.belief}; confidence=${node.confidence.toFixed(2)}`,
                at: Date.now(),
            });
        }
    }

    private emitSpawn(id: string, role: AgentRole, parentId?: string) {
        this.onAgentSpawned?.(id, role, parentId);
        this.pushTranscript({ id, role, parentId, type: 'spawn', content: `${role} spawned`, at: Date.now() });
        this.emitTree();
    }

    private emitTerminate(id: string) {
        const node = this.nodes.get(id);
        if (!node) return;
        this.pushTranscript({
            id,
            role: node.role,
            parentId: node.parentId,
            type: 'terminate',
            content: `${node.role} terminated`,
            at: Date.now(),
        });
    }

    private emitTree() {
        this.onTreeUpdated?.(Array.from(this.nodes.values()));
    }

    private pushTranscript(event: TranscriptEvent) {
        this.transcript.push(event);
        this.onTranscript?.(event);
    }

    private buildOutcome(finalSummary: string): DebateOutcome {
        const scorecard = Array.from(this.nodes.values())
            .filter((n) => ['Philosopher', 'DevilAdvocate', 'Moderator'].includes(n.role))
            .map((n) => {
                const start = this.confidenceStart.get(n.id) ?? n.confidence;
                const delta = n.confidence - start;
                const acc = n.accuracyChecks.total > 0 ? n.accuracyChecks.correct / n.accuracyChecks.total : 0.5;
                return {
                    id: n.id,
                    role: n.role,
                    influence: n.influence,
                    accuracyScore: acc,
                    confidenceDelta: delta,
                    numSubagents: n.numSubagents,
                    finalConfidence: n.confidence,
                };
            });
        return { finalSummary, agentTree: Array.from(this.nodes.values()), scorecard, transcript: this.transcript };
    }

    async close(): Promise<void> {
        for (const a of this.agents.values()) {
            try {
                await a.close();
            } catch {
                /* ignore */
            }
        }
        this.agents.clear();
    }
}

function clamp(v: number, lo = 0, hi = 1): number {
    return Math.max(lo, Math.min(hi, v));
}
