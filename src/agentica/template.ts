import { PromptTemplate } from '@/client-session-manager/types';

interface TemplateConstructor extends StringConstructor {
    (template: string): TemplateClass;
    (strings: TemplateStringsArray, ...values: any[]): TemplateClass;
    new (value: string): TemplateClass;
    isTemplate(value: any): value is TemplateClass;
}

class TemplateClass extends String {
    private _prompt_template = true as const;

    static isTemplate(value: any): value is TemplateClass {
        return value instanceof TemplateClass || (typeof value === 'object' && '_prompt_template' in value);
    }

    constructor(value: string) {
        super(value);
    }

    toPromptTemplate(): PromptTemplate {
        return {
            template: this.toString(),
        };
    }

    toString(): string {
        return '' + this;
    }
}

// Create a callable constructor using a Proxy
const Template = new Proxy(TemplateClass, {
    apply(target, thisArg, args: any[]) {
        if (args.length > 0 && Array.isArray(args[0]) && 'raw' in args[0]) {
            const strings = args[0] as TemplateStringsArray;
            const values = args.slice(1);

            // use String.raw with cooked strings for proper escape sequence handling
            const result = String.raw({ raw: strings }, ...values);
            return new target(result);
        }

        // Called as a regular function: Template("hello")
        if (args.length !== 1) {
            throw new TypeError('Template function must be called with a single string argument');
        }
        return new target(args[0]);
    },
    construct(target, args: [string]) {
        // Called as a constructor: new Template("hello")
        if (args.length !== 1) {
            throw new TypeError('Template constructor must be called with a single string argument');
        }
        return new target(args[0]);
    },
}) as unknown as TemplateConstructor;

export { Template as template };
export type { TemplateClass as Template };

export function maybePromptTemplate<T extends string | TemplateClass | undefined>(
    value: T
): T extends TemplateClass ? PromptTemplate : T extends undefined ? undefined : string {
    if (value === undefined) return undefined as any;
    return (TemplateClass.isTemplate(value) ? value.toPromptTemplate() : value) as any;
}
