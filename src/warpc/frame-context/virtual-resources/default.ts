import { type ScopedLogger } from '@logging/index';
import { FrameContext } from '@warpc/frame-context/frame-ctx';
import { TermDecoder } from '@warpc/frame-context/message-conversion/decoder';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { FunctionMsg } from '@warpc/msg-protocol/concept/resource/function-msg';
import { ObjectMsg } from '@warpc/msg-protocol/concept/resource/object-msg';
import { DefnUID } from '@warpc/msg-protocol/kinds';

import { VirtualDispatcher, Virtualizer } from './virtualizer';

import { throwNoVirtualization } from '@/coming-soon';

export class DefaultVirtualizer implements Virtualizer {
    public readonly manager: FrameContext;
    private logger: ScopedLogger;
    private termDecoder: TermDecoder;

    constructor(public readonly dispatcher: VirtualDispatcher) {
        this.manager = dispatcher.owner.context;
        this.termDecoder = dispatcher.owner.conceptDecoder;
        this.logger = dispatcher.owner.logger.withScope('virtualizer');
    }

    createVirtualObject(msg: ObjectMsg): any {
        throwNoVirtualization();
        const uid: DefnUID = msg.uid;
        const keys: string[] = (msg as any).payload?.keys || [];
        const clsUuid = msg.payload.cls!.uid;
        const clsMsg = this.manager.getMessageFromUID(clsUuid);
        if (!clsMsg) {
            this.logger.error(`Cannot create virtual object without class (uid=${uid.resource})`);
            throw new Error('Cannot create virtual object without class');
        }
        const fields = (clsMsg as ClassMsg).getInstanceFieldNames();
        const methods = (clsMsg as ClassMsg).getInstanceMethodNames();
        this.logger.debug(
            `Creating virtual object (uid=${uid.resource}, fields=${fields.length}, methods=${methods.length})`
        );

        const jsClass = this.termDecoder.decodeWithCtx(clsMsg as ClassMsg);
        const target: any = Object.create(jsClass.prototype);
        return new Proxy(target, {
            get: (_t, prop: PropertyKey) => {
                if (prop === '__uid__') return uid;
                if (typeof prop === 'string') {
                    if (fields.includes(prop)) {
                        return this.dispatcher.virtualGetAttr(uid, prop);
                    }
                    if (methods.includes(prop)) {
                        return (...args: any[]) => this.dispatcher.virtualMethodCall(uid, prop, args);
                    }
                }
                return undefined;
            },
            set: (_t, prop: PropertyKey, value: any) => {
                if (typeof prop === 'string') {
                    if (fields.includes(prop)) {
                        this.dispatcher.virtualSetAttr(uid, prop, value);
                        return true;
                    }
                }
                return false;
            },
            has: (_t, prop: PropertyKey) => {
                if (typeof prop === 'string') {
                    // TODO: Implement this
                    throw new Error('Virtual object attribute check not implemented');
                }
                return false;
            },
            deleteProperty: (_t, prop: PropertyKey) => {
                if (typeof prop === 'string') {
                    this.dispatcher.virtualDelAttr(uid, prop);
                    return true;
                }
                return false;
            },
            ownKeys: () => {
                return Array.from(new Set(['__uid__', ...keys]));
            },
            getOwnPropertyDescriptor: () => ({
                configurable: true,
                enumerable: true,
            }),
        });
    }

    createVirtualClass(msg: ClassMsg): any {
        throwNoVirtualization();
        const uid: DefnUID = msg.uid;

        const { name: className } = msg.payload;
        this.logger.debug(`Creating virtual class ${className} (uid=${uid.resource})`);
        const staticFields = msg.getStaticFieldNames();
        const staticMethods = msg.getStaticMethodNames();
        const baseRefs = msg.getBases();

        // Resolve runtime constructors for bases (if any)
        const resolvedBases = baseRefs
            .map((ref) => this.manager.classes.getResourceFromUID(ref.uid))
            .filter((b): b is any => !!b);
        const PrimaryBase: any = resolvedBases[0] ?? Object;

        const virtualDispatchLogger = this.logger;
        const virtualDispatcher = this.dispatcher;

        const VirtualClass = class extends PrimaryBase {
            _instance: any;

            constructor(...args: any[]) {
                super();
                virtualDispatchLogger.debug(`Virtual class constructor (uid=${uid.resource}, args=`, args);
                this._instance = virtualDispatcher.virtualNew(uid, args, msg.payload.system_resource);
                const instance = this._instance;
                return new Proxy(this, {
                    get: (target, prop: PropertyKey) => {
                        if (prop === '__uid__') return uid;
                        if (prop === 'name') return className;
                        if (prop in target) {
                            return Reflect.get(target, prop);
                        }
                        return instance.then((inst: any) => inst[prop]);
                    },
                    set: (target, prop: PropertyKey, value: any, receiver: any) => {
                        if (prop in target) {
                            return Reflect.set(target, prop, value, receiver);
                        }
                        instance.then((inst: any) => (inst[prop] = value));
                        return true;
                    },
                });
            }

            static get [Symbol.species]() {
                return className;
            }
        };
        Object.defineProperty(VirtualClass, 'name', { value: className, enumerable: false });
        Object.defineProperty(VirtualClass, '__uid__', { value: uid, enumerable: false });

        // Wire static fields through dispatcher
        for (const fieldName of staticFields) {
            this.logger.debug(`Wiring static field ${fieldName} to virtual class ${className}`);
            Object.defineProperty(VirtualClass, fieldName, {
                configurable: true,
                enumerable: true,
                get() {
                    return virtualDispatcher.virtualGetAttr(uid, fieldName);
                },
                set(value: any) {
                    virtualDispatcher.virtualSetAttr(uid, fieldName, value);
                },
            });
        }

        // Wire static methods through dispatcher
        for (const methodName of staticMethods) {
            this.logger.debug(`Wiring static method ${methodName} to virtual class ${className}`);
            Object.defineProperty(VirtualClass, methodName, {
                configurable: true,
                enumerable: true,
                value: (...args: any[]) => virtualDispatcher.virtualMethodCall(uid, methodName, args),
            });
        }

        // Best-effort mixin of additional bases (static and prototype members)
        for (const mixinBase of resolvedBases.slice(1)) {
            this.logger.debug(`Adding mixin base ${mixinBase.name} to virtual class ${className}`);
            // Copy static properties
            for (const key of Object.getOwnPropertyNames(mixinBase)) {
                if (key === 'prototype' || key === 'name' || key === 'length') continue;
                if (Object.prototype.hasOwnProperty.call(VirtualClass, key)) continue;
                const desc = Object.getOwnPropertyDescriptor(mixinBase, key);
                if (desc) {
                    try {
                        Object.defineProperty(VirtualClass, key, desc);
                    } catch {
                        // Ignore property definition errors for mixin bases
                    }
                }
            }
            // Copy prototype methods
            const proto = mixinBase?.prototype ?? {};
            for (const key of Object.getOwnPropertyNames(proto)) {
                if (key === 'constructor') continue;
                if (Object.prototype.hasOwnProperty.call(VirtualClass.prototype, key)) continue;
                const desc = Object.getOwnPropertyDescriptor(proto, key);
                if (desc) {
                    try {
                        Object.defineProperty(VirtualClass.prototype, key, desc);
                    } catch {
                        // Ignore prototype property definition errors for mixin bases
                    }
                }
            }
        }

        this.logger.debug(
            `Creating virtual class ${className} (uid=${uid.resource}, bases=${baseRefs.length}, primary=${
                (PrimaryBase as any).name || 'Object'
            })`
        );

        return VirtualClass as any;
    }

    createVirtualFunction(msg: FunctionMsg): any {
        throwNoVirtualization();
        const uid: DefnUID = msg.uid;
        const fnTarget = function () {} as any;
        this.logger.debug(`Creating virtual function ${msg.payload.name} (uid=${uid.resource})`);

        return new Proxy(fnTarget, {
            get: (_t, prop: PropertyKey) => {
                if (prop === '__uid__') return uid;
                return undefined;
            },
            apply: (_t, _thisArg: any, args: any[]) => {
                return this.dispatcher.virtualFunctionCall(uid, args);
            },
        });
    }
}
