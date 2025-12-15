import { SystemContext } from '@warpc/msg-protocol/concept/resource/system-msg';

import { AnnotationContext } from './annotation-ctx';
import { ClassContext, FrameContext, FunctionContext, ObjectContext } from './frame-ctx';
import { UIDGenerator } from './uid-gen';

import { orUndefined } from '@/common';

const withCustomCall = <T>(cls: T, customCall: (...args: any[]) => any): T => {
    const _Cls: any = cls;
    const _NewCls: any = new Proxy(_Cls, {
        apply(target, thisArg, args) {
            return customCall(...args); // Called as function
        },
        construct(target, args, newTarget) {
            // Called with `new`, forward to original constructor
            return Reflect.construct(_Cls, args, newTarget);
        },
        get(target, prop, receiver) {
            if (prop === 'toString') {
                return Function.prototype.toString.bind(target);
            }
            return Reflect.get(target, prop, receiver);
        },
    });

    Object.getOwnPropertyNames(cls).forEach((prop) => {
        if (prop === 'prototype') return;
        const desc = Object.getOwnPropertyDescriptor(_Cls, prop)!;
        try {
            Object.defineProperty(_NewCls, prop, desc);
        } catch {
            // Ignore property definition errors for non-configurable properties
        }
    });
    Object.getOwnPropertySymbols(_Cls).forEach((sym) => {
        const desc = Object.getOwnPropertyDescriptor(String, sym)!;
        try {
            Object.defineProperty(_NewCls, sym, desc);
        } catch {
            // Ignore symbol property definition errors
        }
    });
    try {
        Object.defineProperty(_NewCls, 'name', { value: _Cls.name });
    } catch {
        // Ignore name property definition errors
    }
    const _Cls_prototype = _Cls.prototype;
    try {
        Object.setPrototypeOf(_NewCls, _Cls);
    } catch {
        // Ignore prototype setting errors
    }
    try {
        _NewCls.prototype = _Cls_prototype;
    } catch {
        // Ignore prototype assignment errors
    }
    return _NewCls as T;
};

const _globalThis: typeof globalThis = Object.assign({}, globalThis);
const _String: typeof String = withCustomCall(String, (value) => {
    // in place of `magicString`, return null for objects with no good string conversion.
    const converted = String(value);
    if (converted === '[object Object]' || value.toString == Object.prototype.toString) return null;
    return converted;
});
_globalThis.String = _String;

export class SystemObjectContext extends ObjectContext {
    constructor(public readonly uidGenerator: UIDGenerator) {
        super(uidGenerator);
        for (const name of SystemContext.getObjectNames()) {
            const uid = SystemContext.getUIDByName(this.world, name);
            const realObj = orUndefined((_globalThis as any)[name], (globalThis as any)[name]);
            const msg = SystemContext.getObjectMsgByName(this.world, name);
            if (uid && realObj !== undefined && msg) this.setRecord(uid, realObj, msg);
        }
    }
}

export class SystemClassContext extends ClassContext {
    constructor(public readonly uidGenerator: UIDGenerator) {
        super(uidGenerator);
        for (const name of SystemContext.getClassNames()) {
            const uid = SystemContext.getUIDByName(this.world, name);
            const ctor = orUndefined((_globalThis as any)[name], (globalThis as any)[name]);
            const msg = SystemContext.getClassMsgByName(this.world, name);
            if (uid && ctor !== undefined && msg) this.setRecord(uid, ctor, msg);
        }
    }
}

function resolveGlobalPath(path: string): any {
    const parts = path.split('.');
    let a: any = _globalThis;
    let b: any = globalThis;
    let receiver: any = undefined;

    for (let i = 0; i < parts.length; i++) {
        if (a === undefined && b === undefined) return undefined;
        receiver = orUndefined(a, b);
        a = a?.[parts[i]];
        b = b?.[parts[i]];
    }

    const current = orUndefined(a, b); // Prioritize `a` from `_globalThis`.
    if (typeof current === 'function') {
        if (receiver === globalThis) return current;
        return current.bind(receiver);
    }
    return current;
}

export class SystemFunctionContext extends FunctionContext {
    constructor(public readonly uidGenerator: UIDGenerator) {
        super(uidGenerator);
        for (const name of SystemContext.getFunctionNames()) {
            const uid = SystemContext.getUIDByName(this.world, name);
            const fn = resolveGlobalPath(name);
            const msg = SystemContext.getFunctionMsgByName(this.world, name);
            if (uid && fn !== undefined && msg) this.setRecord(uid, fn, msg);
        }
    }
}

export class SystemFrameContext extends FrameContext {
    constructor(generator: UIDGenerator) {
        super(
            new SystemObjectContext(generator),
            new SystemClassContext(generator),
            new SystemFunctionContext(generator),
            new AnnotationContext(generator),
            generator
        );
    }
}
