#!/usr/bin/env tsx
/**
 * Standalone CLI demo of the translation dashboard using Ink
 * Run with: npx tsx demo/translation/demo-translation.tsx
 */

import { Box, Text, render, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import React, { useEffect, useMemo, useState } from 'react';

import { TranslationManager } from '../../dist/demo/translation/backend.js';
import { globalConfig } from '../../dist/src/logging/config.js';

// Suppress internal SDK logs
globalConfig.setDefaultLevel('silent');
globalConfig.setScopeLevel('agent', 'silent');

const languageEmojis: Record<string, string> = {
    Spanish: '🇪🇸',
    French: '🇫🇷',
    German: '🇩🇪',
    Japanese: '🇯🇵',
    Italian: '🇮🇹',
    Portuguese: '🇵🇹',
    Korean: '🇰🇷',
    Chinese: '🇨🇳',
};

const AVAILABLE_LANGUAGES = [
    'Spanish', 'French', 'German', 'Japanese',
    'Italian', 'Portuguese', 'Korean', 'Chinese'
] as const;

type Language = typeof AVAILABLE_LANGUAGES[number];

interface TranslatorState {
    language: string; // allow custom languages
    chunks: string[];
    complete: boolean;
}

interface TranslationViewProps {
    text: string;
    languages: string[]; // may include custom user-provided languages
    onNextPhrase?: (text: string) => void;
}

const TranslationView: React.FC<TranslationViewProps> = ({ text, languages, onNextPhrase }) => {
    const [translatorStates, setTranslatorStates] = useState<Map<string, TranslatorState>>(new Map());
    const [isComplete, setIsComplete] = useState(false);
    const [manager] = useState(() => new TranslationManager());
    const [nextPhrase, setNextPhrase] = useState('');
    const { exit } = useApp();

    useEffect(() => {
        manager.onTranslatorSpawned = (id: string, language: string) => {
            setTranslatorStates((prev: Map<string, TranslatorState>) => {
                const newMap = new Map<string, TranslatorState>(prev);
                newMap.set(id, { language, chunks: [], complete: false });
                return newMap;
            });
        };

        manager.onTranslatorProgress = (id: string, chunk: string) => {
            setTranslatorStates((prev: Map<string, TranslatorState>) => {
                const newMap = new Map<string, TranslatorState>(prev);
                const state = newMap.get(id);
                if (state) {
                    state.chunks.push(chunk);
                    newMap.set(id, { ...state });
                }
                return newMap;
            });
        };

        manager.onTranslatorComplete = (id: string) => {
            setTranslatorStates((prev: Map<string, TranslatorState>) => {
                const newMap = new Map<string, TranslatorState>(prev);
                const state = newMap.get(id);
                if (state) {
                    state.complete = true;
                    newMap.set(id, { ...state });
                }
                return newMap;
            });
        };

        // Reset state and start the translation
        const runTranslation = async () => {
            setTranslatorStates(new Map());
            setIsComplete(false);
            await manager.translateToMany(text, languages);
            setIsComplete(true);
        };

        runTranslation().catch(console.error);

        // Cleanup
        return () => {
            manager.close().catch(console.error);
        };
    }, [text, languages, manager]);

    const completedCount = Array.from<TranslatorState>(translatorStates.values()).filter((s: TranslatorState) => s.complete).length;
    const totalCount = translatorStates.size;

    // Allow Esc to exit while on the translation screen as well
    useInput((input, key) => {
        if (key.escape) {
            // Try to close agents, then force exit regardless
            manager.close().catch(() => {}).finally(() => {
                exit();
                setTimeout(() => (globalThis as any).process?.exit(0), 10);
            });
        }
    });

    return (
        <Box flexDirection="column" padding={2}>
            {/* Header */}
            <Box borderStyle="double" borderColor="magenta" paddingX={3} paddingY={1} marginBottom={2}>
                <Text bold color="magenta">
                    🌍 ✨ Multi-Language Translation Dashboard ✨ 🌍
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
                    📝 SOURCE TEXT
                </Text>
                <Box marginTop={1} marginBottom={1}>
                    <Text color="white" italic>
                        &quot;{text}&quot;
                    </Text>
                </Box>
                <Text>
                    <Text bold color="cyan" dimColor>🎯 TARGET LANGUAGES: </Text>
                    <Text color="yellow" bold>{languages.join(' • ')}</Text>
                </Text>
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

            {/* Translations Section */}
            <Box
                borderStyle="round"
                borderColor="yellow"
                paddingX={2}
                paddingY={1}
                flexDirection="column"
            >
                <Box marginBottom={1}>
                    <Text bold color="yellow">
                        🔄 LIVE TRANSLATIONS
                    </Text>
                </Box>

                <Box flexDirection="column" marginTop={1}>
                    {Array.from<[string, TranslatorState]>(translatorStates.entries()).map(([id, state]: [string, TranslatorState]) => {
                        const emoji = languageEmojis[state.language] || '🌐';
                        const translationText = state.chunks.join('');

                        return (
                            <Box
                                key={id}
                                flexDirection="column"
                                marginBottom={1}
                                paddingLeft={1}
                                borderStyle="single"
                                borderColor={state.complete ? "green" : "gray"}
                            >
                                <Box marginBottom={0}>
                                    <Text color={state.complete ? "green" : "cyan"} bold>
                                        {emoji} {state.language}
                                    </Text>
                                    {state.complete && <Text color="green" bold> ✓</Text>}
                                    {!state.complete && <Text color="yellow" bold> ⟳</Text>}
                                </Box>
                                <Box paddingLeft={1} paddingY={0}>
                                    <Text color={state.complete ? "white" : "gray"}>
                                        {translationText || '...'}
                                    </Text>
                                    {!state.complete && <Text color="cyan" bold> ▊</Text>}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* Next input box under translations */}
            <Box
                marginTop={2}
                borderStyle="round"
                borderColor="cyan"
                paddingX={2}
                paddingY={1}
                flexDirection="column"
            >
                <Box marginBottom={1}>
                    <Text bold color="cyan">📝 Enter next text to translate:</Text>
                </Box>
                <Box>
                    <Text color="yellow">› </Text>
                    <TextInput
                        value={nextPhrase}
                        onChange={setNextPhrase}
                        onSubmit={() => {
                            const trimmed = nextPhrase.trim();
                            if (trimmed) {
                                onNextPhrase?.(trimmed);
                                setNextPhrase('');
                            }
                        }}
                        placeholder={isComplete ? 'Type your next text here...' : 'Wait until current translation completes...'}
                    />
                </Box>
                <Box marginTop={1}>
                    <Text dimColor>
                        Press <Text color="green">Enter</Text> to start translation; <Text color="red">Esc</Text> to exit.
                    </Text>
                </Box>
                {!isComplete && (
                    <Box marginTop={1}>
                        <Text dimColor>Current translation in progress...</Text>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

type Step = 'select' | 'input' | 'translate';

const App: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [selectedLanguages, setSelectedLanguages] = useState<Set<Language>>(new Set());
    const [currentStep, setCurrentStep] = useState<Step>('select');
    const [cursorIndex, setCursorIndex] = useState(0);
    const [additionalLanguagesText, setAdditionalLanguagesText] = useState('');
    const [selectFocusIndex, setSelectFocusIndex] = useState<0 | 1>(0); // select step: 0 = list, 1 = additional input
    // previous results UI removed to simplify the demo

    const { exit } = useApp();

    useInput((input, key) => {
        if (currentStep === 'select') {
            if (input === '\t') {
                setSelectFocusIndex(prev => (prev === 0 ? 1 : 0));
                return;
            }
            if (selectFocusIndex === 0 && key.upArrow) {
                setCursorIndex(prev => Math.max(0, prev - 1));
                return;
            }
            if (selectFocusIndex === 0 && key.downArrow) {
                if (cursorIndex === AVAILABLE_LANGUAGES.length - 1) {
                    setSelectFocusIndex(1);
                } else {
                    setCursorIndex(prev => Math.min(AVAILABLE_LANGUAGES.length - 1, prev + 1));
                }
                return;
            }
            if (selectFocusIndex === 1 && key.upArrow) {
                setSelectFocusIndex(0);
                return;
            }
            if (selectFocusIndex === 0 && input === ' ') {
                const lang = AVAILABLE_LANGUAGES[cursorIndex];
                setSelectedLanguages(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(lang)) {
                        newSet.delete(lang);
                    } else {
                        newSet.add(lang);
                    }
                    return newSet;
                });
                return;
            }
            if (key.return && selectedLanguages.size > 0) {
                setCurrentStep('input');
                return;
            }
        } else if (currentStep === 'input') {
            if (key.escape) {
                exit();
                setTimeout(() => (globalThis as any).process?.exit(0), 10);
                return;
            }
        }
    });

    const extraLanguages = useMemo(() => (
        additionalLanguagesText
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
    ), [additionalLanguagesText]);

    const combinedLanguages: string[] = useMemo(() => ([
        ...Array.from(selectedLanguages),
        ...extraLanguages,
    ]), [selectedLanguages, extraLanguages]);

    if (currentStep === 'translate') {
        return (
            <TranslationView
                text={inputText}
                languages={combinedLanguages}
                onNextPhrase={(text: string) => {
                    setInputText(text);
                }}
            />
        );
    }

    return (
        <Box flexDirection="column" padding={2}>
            {/* Header */}
            <Box borderStyle="double" borderColor="magenta" paddingX={3} paddingY={1} marginBottom={2}>
                <Text bold color="magenta">
                    🌍 ✨ Multi-Language Translation Setup ✨ 🌍
                </Text>
            </Box>

            {currentStep === 'select' && (
                <Box flexDirection="column">
                    <Box
                        borderStyle="round"
                        borderColor="yellow"
                        paddingX={2}
                        paddingY={1}
                        marginBottom={1}
                        flexDirection="column"
                    >
                        <Box marginBottom={1}>
                            <Text bold color="yellow">
                                🎯 Select target languages:
                            </Text>
                        </Box>
                        <Box flexDirection="column" marginTop={1}>
                            {AVAILABLE_LANGUAGES.map((lang, index) => {
                                const isSelected = selectedLanguages.has(lang);
                                const isCursor = index === cursorIndex;
                                const emoji = languageEmojis[lang] || '🌐';

                                return (
                                    <Box key={lang}>
                                        <Text color={isCursor && selectFocusIndex === 0 ? 'cyan' : undefined}>
                                            {isCursor ? '→ ' : '  '}
                                            [{isSelected ? '✓' : ' '}] {emoji} {lang}
                                        </Text>
                                    </Box>
                                );
                            })}
                        </Box>
                        <Box marginTop={1}>
                            <Text bold color="yellow">➕ Additional languages (optional)</Text>
                        </Box>
                        <Box>
                            <Text color="yellow">› </Text>
                            <TextInput
                                value={additionalLanguagesText}
                                onChange={setAdditionalLanguagesText}
                                onSubmit={() => {
                                    if (selectedLanguages.size > 0) {
                                        setCurrentStep('input');
                                    }
                                }}
                                placeholder="Klingon, Sami"
                                focus={selectFocusIndex === 1}
                            />
                        </Box>
                    </Box>
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor><Text color="cyan">↑↓</Text> Navigate • <Text color="yellow">Space</Text> Select • <Text color="cyan">Tab</Text> Focus input • <Text color="green">Enter</Text> Continue</Text>
                        <Box marginTop={0}>
                            <Text color="yellow">
                                Selected: {selectedLanguages.size} language{selectedLanguages.size !== 1 ? 's' : ''}
                            </Text>
                        </Box>
                    </Box>
                </Box>
            )}

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
                            <Text bold color="cyan">📝 Enter text to translate:</Text>
                        </Box>
                        <Box>
                            <Text color="yellow">› </Text>
                            <TextInput
                                value={inputText}
                                onChange={setInputText}
                                onSubmit={() => {
                                    if (inputText.trim()) {
                                        setCurrentStep('translate');
                                    }
                                }}
                                placeholder="Type your text here..."
                            />
                        </Box>
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>
                            Press <Text color="green">Enter</Text> to start translation; <Text color="red">Esc</Text> to exit.
                        </Text>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

// Run the app
render(<App />);

