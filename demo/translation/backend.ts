import { Agent, spawn } from '@agentica/agent';

/**
 * Represents a single language translator agent
 */
export class Translator {
    id: string;
    language: string;
    private agent: Agent | null = null;
    onProgress?: (chunk: string) => void;

    constructor(id: string, language: string) {
        this.id = id;
        this.language = language;
    }

    async initialize(): Promise<void> {
        this.agent = await spawn({
            system: `You are an expert ${this.language} translator.
Your task is to provide a single best translation of the user's text into ${this.language}.
STRICT RULES:
- Return ONLY the best-effort translated text.
- Do NOT add explanations, notes, or any extra words.
- Do NOT mention dialects or alternatives.
- Do NOT ask clarifying questions.
- Do NOT use any English, or any other language other than the requested target language in your response.
- Be natural and idiomatic, but concise.
- Preserve meaning precisely as best you can without adding ANY context.`,
            model: 'openai:gpt-4.1',
        });
    }

    async translate(text: string): Promise<string> {
        if (!this.agent) {
            throw new Error(`Translator ${this.id} not initialized`);
        }

        // Use local variable so transformer can handle it
        const agent = this.agent;
        let result: string = await agent.call<string>(
            `Translate the text into "${this.language}". Respond with ONLY the best-effort translated text with NO additional context.\n\n${text}`,
            {
                text,
                language: this.language,
            },
            {
                listener: (iid: string, chunk: { content?: string; role?: string }) => {
                    // Only forward agent-generated content, not system/user messages
                    if (this.onProgress && chunk && chunk.content && chunk.role === 'agent') {
                        this.onProgress(chunk.content);
                    }
                },
            }
        );

        // Post-process to enforce strict output
        result = (result ?? '').trim();
        // Strip code fences and labels like "Translation:" or language prefixes
        result = result
            .replace(/^```[a-z]*\n([\s\S]*?)\n```$/i, '$1')
            .replace(/^\s*(translation\s*:\s*)/i, '')
            .replace(new RegExp(`^\\s*(${this.language})\\s*:\\s*`, 'i'), '')
            .trim();
        // Remove surrounding quotes if model added them
        if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith("'") && result.endsWith("'"))) {
            result = result.slice(1, -1).trim();
        }
        return result;
    }

    async close(): Promise<void> {
        if (this.agent) {
            await this.agent.close();
        }
    }
}

/**
 * Coordinates multiple translator agents working in parallel
 */
export class TranslationManager {
    private translators: Map<string, Translator> = new Map();

    // Callbacks for UI updates
    onTranslatorSpawned?: (id: string, language: string) => void;
    onTranslatorProgress?: (id: string, chunk: string) => void;
    onTranslatorComplete?: (id: string, translation: string) => void;

    async translateToMany(text: string, languages: string[]): Promise<Map<string, string>> {
        // Phase 1: Create and initialize all translators in parallel
        const initPromises = languages.map(async (language, index) => {
            const id = `translator_${index}`;
            const translator = new Translator(id, language);

            // Set up progress callback
            translator.onProgress = (chunk: string) => {
                this.onTranslatorProgress?.(id, chunk);
            };

            // Initialize the translator
            await translator.initialize();
            this.translators.set(id, translator);

            // Notify UI that translator was spawned
            this.onTranslatorSpawned?.(id, language);

            return { id, language, translator };
        });

        const translators = await Promise.all(initPromises);

        // Phase 2: Run all translations in parallel (don't await here!)
        const translationPromises = translators.map(({ id, language, translator }) => {
            return (async () => {
                const finalTranslation = await translator.translate(text);

                // Notify completion
                this.onTranslatorComplete?.(id, finalTranslation);

                return { language, translation: finalTranslation };
            })();
        });

        // Wait for all translations to complete
        const results = await Promise.all(translationPromises);

        // Convert to map for easy lookup
        const translations = new Map<string, string>();
        for (const { language, translation } of results) {
            translations.set(language, translation);
        }

        return translations;
    }

    async close(): Promise<void> {
        // Close all translators
        for (const translator of this.translators.values()) {
            await translator.close();
        }
        this.translators.clear();
    }
}
