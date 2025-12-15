import { FrameContext } from '@warpc/frame-context/frame-ctx';
import { ClassMsg } from '@warpc/msg-protocol/concept/resource/class-msg';
import { DefnUID } from '@warpc/msg-protocol/kinds';

import { ScopedLogger, createLogger } from '@/logging';
import { InterfaceMsg } from '@/warpc/msg-protocol/concept/annotations/annotation-msg';
import { DefMsg, RefMsg } from '@/warpc/msg-protocol/concept/concept';
import { CLASS_IDS, SystemContext } from '@/warpc/msg-protocol/concept/resource/system-msg';

export class SyntheticsFactory {
    private logger: ScopedLogger;
    context: FrameContext;

    constructor(context: FrameContext, logger?: ScopedLogger) {
        this.logger = logger ?? createLogger(`factory:synthetics`);
        this.context = context;
    }

    createSyntheticGenericType(msg: ClassMsg, instance_of_generic: DefnUID, _typeArgs: ClassMsg[]): any {
        const genericBaseName = SystemContext.getNameByUID(instance_of_generic) ?? `GenericAlias`;
        const name = msg.payload.name ?? 'Object';

        const synthCtor = class {
            constructor(..._args: any[]) {
                throw new Error(`Cannot instantiate generic alias ${name} of base type ${genericBaseName}`);
            }
        };

        Object.defineProperty(synthCtor, 'name', {
            value: name,
            writable: false,
            configurable: true,
        });

        Object.defineProperty(synthCtor, '__uid__', {
            value: msg.uid,
            writable: false,
            configurable: true,
        });

        return synthCtor;
    }

    /**
     * Create a synthetic class resource for an interface.
     * Python will create Protocol classes from interfaces and needs to access attributes
     * for introspection (inspect module, print_stubs, etc.).
     */
    createSyntheticClassForInterface(msg: InterfaceMsg, name: string): { ctor: any; msgUp?: ClassMsg } {
        const payload = msg.payload;

        // Maybe turn this into a concrete class (if possible)
        const { ctor: synthCtor, msgUp } = this.maybeMakeConcreteClass(msg);

        // Set the class name
        Object.defineProperty(synthCtor, 'name', {
            value: name,
            writable: false,
            configurable: true,
        });

        // Add docstring if present
        if (payload.doc) {
            Object.defineProperty(synthCtor, '__doc__', {
                value: payload.doc,
                writable: false,
                configurable: true,
            });
        }

        // Add static field stubs
        const clsMsg = msgUp ?? msg.asClass();
        for (const field of clsMsg.getStaticFields()) {
            // Create a getter that throws (Protocols shouldn't be instantiated)
            Object.defineProperty(synthCtor, field.name, {
                get() {
                    throw new Error(`Cannot access field ${field.name} on Protocol ${name}`);
                },
                enumerable: false,
                configurable: true,
            });
        }

        // Add static method stubs
        for (const [methodName] of clsMsg.getStaticMethods()) {
            // Create a method stub that throws if called
            const methodStub = function (this: any, ..._args: any[]) {
                throw new Error(`Cannot call method ${methodName} on Protocol ${name}`);
            };

            // Set method name
            Object.defineProperty(methodStub, 'name', {
                value: methodName,
                writable: false,
                configurable: true,
            });

            // Add to class
            Object.defineProperty(synthCtor, methodName, {
                value: methodStub,
                writable: false,
                enumerable: true,
                configurable: true,
            });
        }

        this.logger.debug(
            `Synthetic class for ${name}: ` +
                `${clsMsg.getStaticFieldNames().length} static fields, ` +
                `${clsMsg.getStaticMethodNames().length} static methods`
        );

        if (msgUp) return { ctor: synthCtor, msgUp };
        else return { ctor: synthCtor };
    }

    /**
     * Create a synthetic class resource for an intersection type by merging
     * fields and methods from its base classes/interfaces. Methods throw if called.
     */
    createSyntheticClassForIntersection(msg: DefMsg, name: string): any {
        // Intersection is a type-only construct; create an empty synthetic class
        // with no own fields or methods so semantics rely on bases only.
        const syntheticClass = class {};
        Object.defineProperty(syntheticClass, 'name', {
            value: name,
            writable: false,
            configurable: true,
        });
        return syntheticClass;
    }

    maybeMakeConcreteClass(msg: InterfaceMsg): { ctor: any; msgUp?: ClassMsg } {
        const uid: DefnUID = msg.uid;

        if (msg.asClass().getStaticFieldNames().length) {
            this.logger.debug(
                `Interface class ${msg.payload.name} (uid=${uid.resource}) has static fields and is therefore not a concrete class`
            );
            return { ctor: class {} };
        }

        if (msg.asClass().getMethodNames().length) {
            this.logger.debug(
                `Interface class ${msg.payload.name} (uid=${uid.resource}) has methods and is therefore not a concrete class`
            );
            return { ctor: class {} };
        }

        const nonOptionalFields = msg.asClass().getNonOptionalFields();
        const optionalFields = msg.asClass().getOptionalFields();
        const indexSignatures = msg.asClass().getIndexSignatures();

        const { name: interfaceName } = msg.payload;
        this.logger.debug(`Creating interface class ${interfaceName} (uid=${uid.resource})`);

        function verifyKeyType(keyType: RefMsg<ClassMsg>, key: any): void {
            switch (keyType.uid.resource) {
                case CLASS_IDS.String:
                    if (typeof key !== 'string') throw new Error(`Key must be a string`);
                    break;
                case CLASS_IDS.Number:
                    if (typeof key !== 'number') throw new Error(`Key must be a number`);
                    break;
                case CLASS_IDS.Symbol:
                    if (typeof key !== 'symbol') throw new Error(`Key must be a symbol`);
                    break;
                default:
                    throw new Error(`Unsupported index signature key type: ${keyType.uid.resource}`);
            }
        }

        const classMsg = msg.asClass();
        classMsg.payload.ctor_args = [];

        // Populate ctor_args metadata
        for (const signature of indexSignatures) {
            classMsg.payload.ctor_args.push({
                name: 'index_signature',
                type: signature.map_type,
            });
        }
        for (const field of nonOptionalFields) {
            classMsg.payload.ctor_args.push({
                name: field.name,
                type: field.type,
                default: field.default,
                optional: field.is_optional,
            });
        }
        for (const field of optionalFields) {
            classMsg.payload.ctor_args.push({
                name: field.name,
                type: field.type,
                default: field.default,
                optional: field.is_optional,
            });
        }

        // Make a concrete class (i.e. class that can be instantiated with a constructor)
        const SyntheticCtor = class {
            constructor(...args: any[]) {
                let arg_position = 0;

                // First read index signatures
                for (const signature of indexSignatures) {
                    const indexMap = args[arg_position++];
                    for (const [key, value] of indexMap) {
                        verifyKeyType(signature.key_type, key);
                        (this as any)[key] = value;
                    }
                }

                // Then read non-optional fields
                for (const field of nonOptionalFields) {
                    (this as any)[field.name] = args[arg_position++];
                }

                // Then read optional fields
                for (const field of optionalFields) {
                    (this as any)[field.name] = args[arg_position++];
                }
            }

            static get [Symbol.species]() {
                return interfaceName;
            }
        };

        Object.defineProperty(SyntheticCtor, 'name', { value: interfaceName, enumerable: false });
        Object.defineProperty(SyntheticCtor, '__uid__', { value: uid, enumerable: false });

        return { ctor: SyntheticCtor, msgUp: classMsg };
    }
}
