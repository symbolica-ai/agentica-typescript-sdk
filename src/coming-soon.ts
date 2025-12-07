import type { FrameContext } from '@/warpc/frame-context/frame-ctx';
import type { ToolModeStrings } from '@agentica/common';

import { id } from '@/common';

enum Feature {
    JSON_MODE = 'JSON mode',
    ENUM_VALUES = 'Enum support',
    FUTURE_VALUES = 'Promises and futures',
    LOCAL_FILE_ACCESS = 'Local file access',
    ADVANCED_ITERATORS = 'Advanced iterator objects',
    NUMERIC_RANGES = 'Numeric range objects',
    BINARY_BUFFERS = 'Binary buffer objects',
    URL_OBJECTS = 'URL objects',
    JSON_BASE_EXCEPTIONS = 'Richer exceptions in JSON mode',
    CUSTOM_EXCEPTIONS = 'Custom exceptions',
    TYPE = 'Type',
    TYPE_CONSTRUCTORS = 'Type constructor',
    ARBITRARY = 'Arbitrary',
    VIRTUALIZATION = 'Virtualization',
    UNSUPPORTED_BUILTIN_CLASS = 'Unsupported builtin class',
    GENERATORS = 'Generators',
    INTERFACE_RETURN_TYPE = 'Interface as return type',
    INTERSECTION_RETURN_TYPE = 'Intersection as return type',
}

export class ComingSoon extends Error {
    feature: Feature;
    mode?: ToolModeStrings;
    detail?: string;

    constructor(feature: Feature, mode?: ToolModeStrings, detail: string = '') {
        super(`${feature} ${detail} is Coming Soon${mode ? ` in ${mode} mode` : ''}!`.replace(/\s\s+/g, ' '));
        this.feature = feature;
        this.mode = mode;
        this.detail = detail;
    }
}

export class TryCodeMode extends Error {
    feature: Feature;
    detail: string;

    constructor(feature: Feature, detail: string = '') {
        super(`${feature} ${detail} may work in 'code' mode but not in 'json' mode!`.replace(/\s\s+/g, ' '));
        this.feature = feature;
        this.detail = detail;
    }
}

// helpers should be runtime-safe across node and browser
const isObjectLike = (value: any): boolean =>
    value !== null && (typeof value === 'object' || typeof value === 'function');

const getIdIfObject = (value: any): number | null => (isObjectLike(value) ? id(value) : null);

const isFileHandleLike = (obj: any): boolean => {
    if (!isObjectLike(obj)) return false;
    // browser?
    try {
        if (typeof File !== 'undefined' && obj instanceof File) return true;
    } catch {
        // Ignore if File is not available
    }
    try {
        if (typeof Blob !== 'undefined' && obj instanceof Blob) return true;
    } catch {
        // Ignore if Blob is not available
    }
    try {
        if (typeof ReadableStream !== 'undefined' && obj instanceof ReadableStream) return true;
    } catch {
        // Ignore if ReadableStream is not available
    }
    // node?
    if (typeof (obj as any).path === 'string') return true;
    if (typeof (obj as any).fd === 'number') return true;
    if (typeof (obj as any).createReadStream === 'function') return true;
    if (typeof (obj as any).createWriteStream === 'function') return true;
    return false;
};

const isUrlObjectLike = (obj: any): boolean => {
    if (!isObjectLike(obj)) return false;
    try {
        if (typeof URL !== 'undefined' && obj instanceof URL) return true;
    } catch {
        // Ignore if URL is not available
    }
    try {
        if (typeof URLSearchParams !== 'undefined' && obj instanceof URLSearchParams) return true;
    } catch {
        // Ignore if URLSearchParams is not available
    }
    const o = obj as any;
    if (typeof o?.href === 'string' && typeof o?.protocol === 'string') return true;
    return false;
};

const isGeneratorLike = (obj: any): boolean => {
    if (!isObjectLike(obj)) return false;
    return typeof obj.next === 'function' && typeof obj.throw === 'function' && typeof obj.return === 'function';
};

export const validateFeature = (thing: any, mode: ToolModeStrings = 'code'): void => {
    const seen: Set<number> = new Set();

    const _check = (obj: any): void => {
        const objId = getIdIfObject(obj);
        if (objId !== null) {
            if (seen.has(objId)) return;
            seen.add(objId);
        }

        if (isGeneratorLike(obj)) {
            throw new ComingSoon(Feature.GENERATORS, mode);
        }

        if (isFileHandleLike(obj)) {
            throw new ComingSoon(Feature.LOCAL_FILE_ACCESS, mode);
        }

        if (ArrayBuffer.isView(obj) || obj instanceof ArrayBuffer) {
            throw new ComingSoon(Feature.BINARY_BUFFERS, mode);
        }

        if (isUrlObjectLike(obj)) {
            throw new ComingSoon(Feature.URL_OBJECTS, mode);
        }

        // recurse
        if (obj instanceof Map) {
            for (const v of obj.values()) _check(v);
            return;
        }
        if (obj instanceof Set) {
            for (const v of obj.values()) _check(v);
            return;
        }
        if (Array.isArray(obj)) {
            for (const v of obj) _check(v);
            return;
        }
        if (isObjectLike(obj) && obj.constructor === Object) {
            for (const v of Object.values(obj)) _check(v);
            return;
        }

        if (mode === 'json') {
            // we just do not support json-mode at all
            throw new TryCodeMode(Feature.ARBITRARY);
        }
    };

    _check(thing);
};

export const constructorTypes = (mode: ToolModeStrings = 'code'): ComingSoon => {
    return new ComingSoon(Feature.TYPE_CONSTRUCTORS, mode, 'and built-in type support');
};

export const unsupportedBultinClass = (className: string, mode: ToolModeStrings = 'code'): ComingSoon => {
    return new ComingSoon(Feature.UNSUPPORTED_BUILTIN_CLASS, mode, `(${className})`);
};

export const unsupportedEnum = (enumName: string, mode: ToolModeStrings = 'code'): ComingSoon => {
    return new ComingSoon(
        Feature.ENUM_VALUES,
        mode,
        `(enum '${enumName}'). Use string or number literal unions instead: type MyType = "value1" | "value2" | "value3"`
    );
};

export const interfaceReturnType = (mode: ToolModeStrings = 'code'): ComingSoon => {
    return new ComingSoon(Feature.INTERFACE_RETURN_TYPE, mode);
};

export const intersectionReturnType = (mode: ToolModeStrings = 'code'): ComingSoon => {
    return new ComingSoon(Feature.INTERSECTION_RETURN_TYPE, mode);
};

export const validateReturnType = (returnType: any, context: FrameContext, mode: ToolModeStrings = 'code'): void => {
    const seen = new Set<string>();

    const check = (type: any): void => {
        if (!type) return;

        if (type.kind === 'ref') {
            const resolved = context.getMessageFromUID(type.uid);
            if (resolved) {
                check(resolved);
            }
            return;
        }

        if (type.uid) {
            const uidStr = `${type.uid.world}:${type.uid.resource}`;
            if (seen.has(uidStr)) return;
            seen.add(uidStr);
        }

        if (type.kind === 'interface') {
            throw interfaceReturnType(mode);
        }

        if (type.kind === 'intersection') {
            throw intersectionReturnType(mode);
        }

        if (type.kind === 'union') {
            for (const member of type.payload.classes) {
                check(member);
            }
            return;
        }
    };

    check(returnType);
};

export const throwNoJsonMode = () => {
    throw new ComingSoon(Feature.JSON_MODE);
};

export const throwNoVirtualization = () => {
    throw new ComingSoon(Feature.VIRTUALIZATION, 'code', 'of remote resources');
};

export const throwNoBareFutures = () => {
    throw new ComingSoon(Feature.FUTURE_VALUES, 'code', 'as values that can be passed to the agent');
};

export default ComingSoon;
