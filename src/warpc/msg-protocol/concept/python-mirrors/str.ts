import { getJsClassName, getJsSymbolName } from './utils';

export interface StringifierOptions {
    maxDepth?: number;
    repr?: boolean;
}
class Stringifier {
    private _seen = new Set<any>();
    private _currentDepth = 0;
    private readonly _options: Required<StringifierOptions>;

    constructor(options: StringifierOptions = {}) {
        this._options = {
            maxDepth: options.maxDepth ?? 3,
            repr: options.repr ?? false,
        };
    }

    private get _isRoot() {
        return this._currentDepth == 0;
    }
    private _token(name: string) {
        return `<${name}>`;
    }

    private _dataclassStyle(
        ctorName: string,
        args: string[] = [],
        kwargs: readonly (readonly [string, string])[] = []
    ) {
        const props = [...args, ...kwargs.map(([k, v]) => `${k}=${v}`)].join(', ');
        return `${ctorName}(${props})`;
    }

    private _error(o: Error) {
        if (this._isRoot) {
            return o.message;
        } else {
            return this._dataclassStyle(getJsClassName(o), [o.message]);
        }
    }

    private _bool(o: boolean) {
        return o ? 'True' : 'False';
    }
    private _nonish(_: undefined | null) {
        return 'None';
    }
    private _sanitizeKey(k: string) {
        // TODO: Implement for compatibility with Python idents
        return k;
    }
    private _reprString(o: string) {
        return JSON.stringify(o);
    }
    private _string(o: string) {
        if (this._options.repr) {
            return this._reprString(o);
        }
        if (this._isRoot) {
            return o;
        }
        return `'${o}'`;
    }
    private _function(o: (...args: any[]) => any) {
        return this._token(`function ${o.name}`);
    }
    private _array(o: any[]) {
        const arr = [];
        for (const item of o) {
            this._currentDepth++;
            const result = this.stringify(item);
            this._currentDepth--;
            // Check length?
            arr.push(result);
        }
        return `[${arr.join(', ')}]`;
    }
    private _number(o: number | bigint) {
        return `${o}`;
    }

    private _symbol(o: symbol) {
        return this._dataclassStyle('Symbol', [getJsSymbolName(o)]);
    }

    private _circular(o: object) {
        return this._token(`circular ${getJsClassName(o)}`);
    }
    private _depthExceeded(o: object) {
        return this._token(`depth exceeded ${getJsClassName(o)}`);
    }
    private _object(o: any) {
        const stringifiedPairs = [];
        // Using Object.keys to avoid getter side-effects
        // Ignore inherited, non-enumerable, and symbol keys
        for (const k of Object.keys(o)) {
            let stringified: string;
            try {
                this._currentDepth++;

                // Resolve the property; might be a getter
                const value = o[k];
                stringified = this.stringify(value);
            } catch (e: any) {
                // Getters might error.
                stringified = this._token(`errored(${e.message})`);
            }
            this._currentDepth--;

            const pair = [this._sanitizeKey(k), stringified] as const;
            stringifiedPairs.push(pair);
        }
        return this._dataclassStyle(getJsClassName(o), [], stringifiedPairs);
    }

    stringify(item: any): string {
        if (item === null || item === undefined) {
            return this._nonish(item);
        }
        if (typeof item === 'boolean') {
            return this._bool(item);
        }
        if (typeof item === 'string') {
            return this._string(item);
        }
        if (typeof item === 'number' || typeof item === 'bigint') {
            // Python's int is unbounded so it will work fine with bigint
            return this._number(item);
        }
        if (typeof item === 'symbol') {
            // Python doesn't actually have this
            return this._symbol(item);
        }
        if (typeof item === 'function') {
            return this._function(item);
        }
        if (this._seen.has(item)) {
            return this._circular(item);
        }
        if (this._currentDepth >= this._options.maxDepth) {
            return this._depthExceeded(item);
        }
        this._seen.add(item);

        try {
            if (item instanceof Error) {
                return this._error(item);
            }
            // <- Add more specific object types here if desired
            if (Array.isArray(item)) {
                return this._array(item);
            }
            this._seen.add(item);
            const result = this._object(item);
            return result;
        } finally {
            this._seen.delete(item);
        }
    }
}
export function __str__(obj: any, options: Omit<StringifierOptions, 'repr'> = {}): string {
    const x = new Stringifier(options);
    return x.stringify(obj);
}

export function __repr__(obj: any, options: Omit<StringifierOptions, 'repr'> = {}): string {
    const x = new Stringifier({ ...options, repr: true });
    return x.stringify(obj);
}
