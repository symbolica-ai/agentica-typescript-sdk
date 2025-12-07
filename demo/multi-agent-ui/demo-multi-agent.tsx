#!/usr/bin/env tsx
/**
 * Standalone CLI demo of the translation dashboard using Ink
 * Run with: npx tsx demo/translation/demo-translation.tsx
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

import { Box, Text, render, useInput } from 'ink';
import TextInput from 'ink-text-input';
import React, { useEffect, useState } from 'react';

import { type AgentNode, type AgentRole, DebateManager, type DebateOutcome } from '../../dist/demo/multi-agent-ui/backend.js';
import { globalConfig } from '../../dist/src/logging/config.js';

// Suppress internal SDK logs
globalConfig.setDefaultLevel('silent');
globalConfig.setScopeLevel('agent', 'silent');

const roleEmojis: Record<AgentRole, string> = {
    Philosopher: '🧠',
    DevilAdvocate: '😈',
    Moderator: '🧑‍⚖️',
    FactChecker: '🔍',
    Contextualizer: '📚',
    Arbiter: '⚖️',
    Mediator: '🕊️',
    SelfReflector: '🤔',
};

interface AgentUiState {
    id: string;
    role: AgentRole;
    text: string;
    complete: boolean;
}

interface DebateViewProps {
    inputText: string;
    topic?: string;
    tone?: string;
}

const DebateView: React.FC<DebateViewProps> = ({ inputText, topic, tone }) => {
    const [agentStates, setAgentStates] = useState<Map<string, AgentUiState>>(new Map());
    const [tree, setTree] = useState<AgentNode[]>([]);
    const [transcript, setTranscript] = useState<Array<{ id: string; role: AgentRole; content: string }>>([]);
    const [outcome, setOutcome] = useState<DebateOutcome | null>(null);
    const [manager] = useState(() => new DebateManager());

    useEffect(() => {
        manager.onAgentSpawned = (id: string, role: AgentRole) => {
            setAgentStates(prev => {
                const map = new Map(prev);
                map.set(id, { id, role, text: '', complete: false });
                return map;
            });
        };

        manager.onAgentMessageChunk = (id: string, chunk: string) => {
            setAgentStates(prev => {
                const map = new Map(prev);
                const s = map.get(id);
                if (s) map.set(id, { ...s, text: s.text + chunk });
                return map;
            });
        };

        manager.onAgentMessageComplete = (id: string, message: string) => {
            setAgentStates(prev => {
                const map = new Map(prev);
                const s = map.get(id);
                if (s) map.set(id, { ...s, text: message, complete: true });
                return map;
            });
            const node = tree.find(n => n.id === id);
            setTranscript(prev => prev.concat([{ id, role: node ? node.role : 'Moderator', content: message }]));
        };

        manager.onTreeUpdated = (nodes: AgentNode[]) => {
            setTree(nodes);
        };

        manager.onDebateComplete = (o: DebateOutcome) => {
            setOutcome(o);
        };

        manager.onTranscript = (e) => {
            setTranscript(prev => prev.concat([{ id: e.id, role: e.role, content: e.content }]));
        };

        const run = async () => {
            await manager.debate({ text: inputText, topic, tone }, { maxRounds: 6 });
        };
        run().catch(console.error);

        return () => {
            manager.close().catch(console.error);
        };
    }, [manager, inputText, topic, tone]);

    // Export when outcome arrives
    useEffect(() => {
        if (!outcome) return;
        try {
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const base = `debate_report_${ts}`;
            const jsonPath = join(process.cwd(), `${base}.json`);
            const mdPath = join(process.cwd(), `${base}.md`);
            writeFileSync(jsonPath, JSON.stringify(outcome, null, 2), 'utf-8');
            const md = buildMarkdownReport(outcome);
            writeFileSync(mdPath, md, 'utf-8');
        } catch (e) {
             
            console.error('Failed to export report:', e);
        }
    }, [outcome]);

    const completedCount = Array.from(agentStates.values()).filter(s => s.complete).length;
    const totalCount = agentStates.size;
    const isComplete = Boolean(outcome);

    return (
        <Box flexDirection="column" padding={2}>
            {/* Header */}
            <Box borderStyle="double" borderColor="magenta" paddingX={3} paddingY={1} marginBottom={2}>
                <Text bold color="magenta">
                    🗣️ ✨ Multi-Agent Debate Club ✨ 🗣️
                </Text>
            </Box>

            {/* Input Section */}
            <Box
                borderStyle="round"
                borderColor="cyan"
                paddingX={2}
                paddingY={1}
                marginBottom={2}
                flexDirection="column"
            >
                <Text bold color="cyan" dimColor>
                    📝 DEBATE INPUT
                </Text>
                <Box marginTop={1} marginBottom={1}>
                    <Text color="white" italic>
                        &quot;{inputText}&quot;
                    </Text>
                </Box>
                {(topic || tone) && (
                    <Text>
                        <Text bold color="cyan" dimColor>🎯 META: </Text>
                        <Text color="yellow" bold>{[topic, tone].filter(Boolean).join(' • ')}</Text>
                    </Text>
                )}
            </Box>

            {/* Progress Bar */}
            {totalCount > 0 && (
                <Box marginBottom={2}>
                    <Text>
                        <Text bold color="blue">⚡ Progress: </Text>
                        <Text color={isComplete ? "green" : "yellow"} bold>
                            {completedCount}/{totalCount} completed
                        </Text>
                        {isComplete && <Text color="green"> 🎉</Text>}
                    </Text>
                </Box>
            )}

            {/* Nested Agent Tree Front-and-Center */}
            <Box borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} flexDirection="column">
                <Text bold color="yellow">🔄 LIVE DEBATE (Nested Agents)</Text>
                <Box marginTop={1} flexDirection="column">
                    {renderTreeWithContent(tree, agentStates)}
                </Box>
            </Box>

            {/* Agent Tree Visualization */}
            <Box marginTop={1} borderStyle="round" borderColor="magenta" paddingX={2} paddingY={1} flexDirection="column">
                <Text bold color="magenta">🌳 AGENT TREE</Text>
                <Box marginTop={1} flexDirection="column">
                    {renderTree(tree)}
                </Box>
            </Box>

            {/* Transcript (fixed height) */}
            <Box marginTop={1} borderStyle="round" borderColor="blue" paddingX={2} paddingY={1} flexDirection="column">
                <Text bold color="blue">🧾 TRANSCRIPT</Text>
                <Box marginTop={1} flexDirection="column" height={6} overflow="hidden">
                    {transcript.slice(-6).map((t, idx) => (
                        <Box key={`${t.id}-${idx}`}>
                            <Text>{roleEmojis[t.role]} {t.role}: </Text>
                            {renderMarkdown(t.content, true)}
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* Final Outcome */}
            {outcome && (
                <Box marginTop={1} borderStyle="bold" borderColor="green" paddingX={2} paddingY={1} flexDirection="column">
                    <Text bold color="green">✅ Debate Complete</Text>
                    <Box marginTop={1} flexDirection="column">
                        {renderMarkdown(outcome.finalSummary, true)}
                    </Box>
                    <Box marginTop={1} flexDirection="column">
                        <Text bold color="green">Scorecard</Text>
                        {outcome.scorecard.map(s => (
                            <Text key={s.id} color="white">
                                {roleEmojis[s.role]} {s.role} {s.id}: influence {s.influence}, accuracy {(s.accuracyScore*100).toFixed(0)}%, Δconf {(s.confidenceDelta>=0?'+':'')+s.confidenceDelta.toFixed(2)}, subs {s.numSubagents}, conf {s.finalConfidence.toFixed(2)}
                            </Text>
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

const App: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [topic, setTopic] = useState('');
    const [tone, setTone] = useState('');
    const [currentStep, setCurrentStep] = useState<'input' | 'debate'>('input');
    const [focusedField, setFocusedField] = useState<'text' | 'topic' | 'tone'>('text');

    useInput((input, key) => {
        if (currentStep !== 'input') return;
        // Enter advances within the form only by each field's onSubmit
        // Tab cycles focus forward; Shift+Tab cycles backward
        const isTab = (input === '\t') || (key as any).tab;
        if (isTab && key.shift) {
            setFocusedField(prev => (prev === 'tone' ? 'topic' : prev === 'topic' ? 'text' : 'tone'));
        } else if (isTab) {
            setFocusedField(prev => (prev === 'text' ? 'topic' : prev === 'topic' ? 'tone' : 'text'));
        }
    });

    if (currentStep === 'debate') {
        return <DebateView inputText={inputText} topic={topic || undefined} tone={tone || undefined} />;
    }

    return (
        <Box flexDirection="column" padding={2}>
            {/* Header */}
            <Box borderStyle="double" borderColor="magenta" paddingX={3} paddingY={1} marginBottom={2}>
                <Text bold color="magenta">
                    🏛️ ✨ Document Debate Club Setup ✨ 🏛️
                </Text>
            </Box>

            {currentStep === 'input' && (
                <Box flexDirection="column">
                    <Box
                        borderStyle="round"
                        borderColor="cyan"
                        paddingX={2}
                        paddingY={1}
                        marginBottom={1}
                        flexDirection="column"
                    >
                        <Box marginBottom={1}>
                            <Text bold color="cyan">
                                📝 Enter debate input (text, document, or statement):
                            </Text>
                        </Box>
                        <Box>
                            <Text color="yellow">› </Text>
                            <TextInput
                                value={inputText}
                                onChange={setInputText}
                                focus={focusedField === 'text'}
                                onSubmit={() => setFocusedField('topic')}
                                placeholder="Type your text here..."
                            />
                        </Box>
                    </Box>

                    <Box
                        borderStyle="round"
                        borderColor="yellow"
                        paddingX={2}
                        paddingY={1}
                        marginBottom={1}
                        flexDirection="column"
                    >
                        <Box marginBottom={1}>
                            <Text bold color="yellow">🎯 Optional metadata</Text>
                        </Box>
                        <Box>
                            <Text color="yellow">Topic: </Text>
                            <TextInput
                                value={topic}
                                onChange={setTopic}
                                focus={focusedField === 'topic'}
                                onSubmit={() => setFocusedField('tone')}
                                placeholder="e.g., AI ethics"
                            />
                        </Box>
                        <Box marginTop={1}>
                            <Text color="yellow">Tone: </Text>
                            <TextInput
                                value={tone}
                                onChange={setTone}
                                focus={focusedField === 'tone'}
                                onSubmit={() => { if (inputText.trim()) setCurrentStep('debate'); }}
                                placeholder="e.g., academic, skeptical"
                            />
                        </Box>
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>
                            Use <Text color="green">Tab</Text>/<Text color="green">Shift+Tab</Text> to switch fields. Press <Text color="green">Enter</Text> to advance; Enter on Tone starts the debate.
                        </Text>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

// Run the app
render(<App />);

// Helpers
function renderTree(nodes: AgentNode[]): React.ReactNode {
    const byId = new Map(nodes.map(n => [n.id, n] as const));
    const roots = nodes.filter(n => !n.parentId);

    const renderNode = (node: AgentNode, depth: number): React.ReactNode => {
        const prefix = ' '.repeat(depth * 2) + (depth > 0 ? '↳ ' : '');
        const emoji = roleEmojis[node.role] || '🌐';
        const statusColor = node.status === 'terminated' ? 'gray' : node.status === 'resolved' ? 'green' : 'cyan';
        const children = node.children.map(id => byId.get(id)).filter(Boolean) as AgentNode[];
        return (
            <Box key={node.id} flexDirection="column">
                <Text color={statusColor}>
                    {prefix}{emoji} {node.role} [{node.id}] • conf {node.confidence.toFixed(2)} • subs {node.numSubagents} • {node.status}
                </Text>
                {children.map(child => renderNode(child, depth + 1))}
            </Box>
        );
    };

    return (
        <Box flexDirection="column">
            {roots.length === 0 && (
                <Text dimColor>(tree will appear as agents spawn)</Text>
            )}
            {roots.map(r => renderNode(r, 0))}
        </Box>
    );
}

function renderTreeWithContent(nodes: AgentNode[], agentStates: Map<string, AgentUiState>): React.ReactNode {
    const byId = new Map(nodes.map(n => [n.id, n] as const));
    const roots = nodes.filter(n => !n.parentId);

    const nodeColor = (status: AgentNode['status']) => status === 'terminated' ? 'gray' : status === 'resolved' ? 'green' : 'cyan';

    const renderNode = (node: AgentNode, depth: number): React.ReactNode => {
        const state = agentStates.get(node.id);
        const emoji = roleEmojis[node.role] || '🌐';
        const children = node.children.map(id => byId.get(id)).filter(Boolean) as AgentNode[];
        const borderColor = nodeColor(node.status);
        return (
            <Box key={node.id} flexDirection="column" marginLeft={depth > 0 ? 2 : 0} borderStyle="round" borderColor={borderColor} paddingX={1} paddingY={0}>
                <Text color={borderColor}>
                    {emoji} {node.role} [{node.id}] • conf {node.confidence.toFixed(2)}
                </Text>
                <Box paddingLeft={1}>
                    {renderMarkdown((state && state.text) ? state.text : '(awaiting message)', state && state.complete)}
                    {state && !state.complete && <Text color="cyan" bold> ▊</Text>}
                </Box>
                {children.length > 0 && (
                    <Box flexDirection="column" marginTop={1}>
                        {children.map(child => renderNode(child, depth + 1))}
                    </Box>
                )}
            </Box>
        );
    };

    return (
        <Box flexDirection="column">
            {roots.length === 0 && (
                <Text dimColor>(agents will appear as they spawn)</Text>
            )}
            {roots.map(r => (
                <Box key={`root-${r.id}`} flexDirection="column" marginBottom={1}>
                    {renderNode(r, 0)}
                </Box>
            ))}
        </Box>
    );
}

// Minimal markdown renderer for Ink (bold, italics, code, bullets)
function renderMarkdown(md: string, complete?: boolean): React.ReactNode {
    const color = complete ? 'white' : 'gray';
    // Split by lines; very small subset of markdown
    const lines = md.split(/\r?\n/).slice(0, 6); // keep short
    return (
        <Box flexDirection="column">
            {lines.map((line, idx) => {
                // bullets
                if (/^\s*[-*]\s+/.test(line)) {
                    const text = line.replace(/^\s*[-*]\s+/, '• ');
                    return <Text key={idx} color={color}>{text}</Text>;
                }
                // inline code
                const codeMatch = line.match(/`([^`]+)`/);
                if (codeMatch) {
                    const parts = line.split(/`([^`]+)`/);
                    return (
                        <Text key={idx} color={color}>
                            {parts.map((p, i) => i % 2 === 1 ? <Text key={i} color="yellow">{p}</Text> : p)}
                        </Text>
                    );
                }
                // bold **text** and italics *text*
                const styled = line
                    .replace(/\*\*([^*]+)\*\*/g, (_: any, g1: string) => `\u0001${g1}\u0002`) // mark bold
                    .replace(/\*([^*]+)\*/g, (_: any, g1: string) => `\u0003${g1}\u0004`); // mark italic
                // eslint-disable-next-line no-control-regex
                const segments = styled.split(/(\u0001|\u0002|\u0003|\u0004)/);
                let mode: 'normal' | 'bold' | 'italic' = 'normal';
                return (
                    <Text key={idx}>
                        {segments.map((seg, i) => {
                            if (seg === '\u0001') { mode = 'bold'; return null; }
                            if (seg === '\u0002') { mode = 'normal'; return null; }
                            if (seg === '\u0003') { mode = 'italic'; return null; }
                            if (seg === '\u0004') { mode = 'normal'; return null; }
                            if (mode === 'bold') return <Text key={i} color={color} bold>{seg}</Text>;
                            if (mode === 'italic') return <Text key={i} color={color} italic>{seg}</Text>;
                            return <Text key={i} color={color}>{seg}</Text>;
                        })}
                    </Text>
                );
            })}
        </Box>
    );
}

function buildMarkdownReport(o: DebateOutcome): string {
    const header = `# Debate Report\n`;
    const summary = `\n## Final Summary\n\n${o.finalSummary}\n`;
    const score = `\n## Scorecard\n\n` + o.scorecard.map(s => `- ${s.role} (${s.id}): influence ${s.influence}, accuracy ${(s.accuracyScore*100).toFixed(0)}%, Δconf ${s.confidenceDelta.toFixed(2)}, subs ${s.numSubagents}, conf ${s.finalConfidence.toFixed(2)}`).join('\n') + '\n';
    const tree = `\n## Agent Tree\n\n` + o.agentTree.map(n => `- ${n.parentId ? `(${n.parentId}) → ` : ''}${n.role} ${n.id} [${n.status}] conf=${n.confidence.toFixed(2)} subs=${n.numSubagents}`).join('\n') + '\n';
    const transcript = `\n## Transcript\n\n` + o.transcript.map(e => `- [${new Date(e.at).toISOString()}] ${e.type.toUpperCase()} ${e.role} ${e.id}: ${e.content}`).join('\n') + '\n';
    return header + summary + score + tree + transcript;
}


