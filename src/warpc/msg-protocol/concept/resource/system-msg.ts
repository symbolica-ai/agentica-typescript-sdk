import { extractAllPropertyNames } from '@warpc/frame-context/message-conversion/encoder';
import { RefMsg } from '@warpc/msg-protocol/concept/concept';
import { DefnUID, World } from '@warpc/msg-protocol/kinds';

import { ClassMsg } from './class-msg';
import { FunctionMsg } from './function-msg';
import { ObjectMsg } from './object-msg';
import { __repr__, __str__ } from '../python-mirrors/str';
import { AtomMsg, BoolMsg, FloatMsg, IntMsg, StrMsg } from '../value/atom';

declare global {
    function magicStackTrace(): string | undefined;
    function magicRepr(obj: any): string;
    function magicLen(obj: any): number;
    function magicKeys(obj: any): string[];
    function magicStr(obj: any): string;
    var MagicNone: object;
    var AttributeError: typeof Error;
    var KeyError: typeof Error;
    var ValueError: typeof Error;
}

globalThis.magicStackTrace = function (): string | undefined {
    return new Error().stack;
};

globalThis.magicStr = function (obj: any): string {
    return __str__(obj, {
        maxDepth: 3,
    });
};

globalThis.magicRepr = function (obj: any): string {
    return __repr__(obj, {
        maxDepth: 3,
    });
};

globalThis.magicLen = function (obj: any): number {
    if (typeof obj === 'string' || Array.isArray(obj)) return obj.length;
    return Object.keys(obj).length;
};

globalThis.magicKeys = function (obj: any): string[] {
    return Array.from(extractAllPropertyNames(obj));
};

globalThis.MagicNone = {
    toString: () => 'None',
};

globalThis.AttributeError = class AttributeError extends Error {} as typeof Error;
globalThis.KeyError = class KeyError extends Error {} as typeof Error;
globalThis.ValueError = class ValueError extends Error {} as typeof Error;

export const ATOMIC_IDS: Record<string, number> = {
    object: -1,
    string: -2,
    number: -3,
    boolean: -4,
    symbol: -2,
    void: -10,
    undefined: -10,
    null: -10,
};

export const CLASS_IDS: Record<string, number> = {
    Object: -1,
    Any: -1,
    String: -2,
    Number: -3,
    Boolean: -4,
    Array: -5,
    Map: -6,
    Set: -7,
    Function: -8,
    Future: -9,
    MagicNone: -10,
    Tuple: -13,
    Never: -14,
    Literal: -15,
    Enum: -16,
    TYPE: -42,
    // Exceptions
    Error: -50,
    AttributeError: -51,
    KeyError: -52,
    ValueError: -53,
    TypeError: -54,
};

export const OBJECT_IDS: Record<string, number> = {
    console: -101,
    Math: -102,
    JSON: -103,
};

export const FUNCTION_IDS: Record<string, number> = {
    parseInt: -201,
    parseFloat: -202,
    isNaN: -203,
    isFinite: -204,
    magicInstanceof: -205,
    magicRepr: -301,
    'console.log': -302,
    magicStackTrace: -303,
    magicLen: -304,
    magicKeys: -305,
    magicStr: -306,
    'Object.entries': -401,
    'Object.keys': -402,
    'Object.is': -403,
    'Object.toString': -404,
    'Reflect.getPrototypeOf': -501,
    'Reflect.isExtensible': -502,
    'Reflect.has': -503,
};

export class SystemContext {
    static getUIDByName(world: World, name: string): DefnUID | undefined {
        const id = ATOMIC_IDS[name] ?? CLASS_IDS[name] ?? OBJECT_IDS[name] ?? FUNCTION_IDS[name];
        return typeof id === 'number' ? ({ world, resource: id } as DefnUID) : undefined;
    }

    static getNameByUID(uid: DefnUID): string | undefined {
        return (
            Object.keys(ATOMIC_IDS).find((name: string) => ATOMIC_IDS[name] === uid.resource) ??
            Object.keys(CLASS_IDS).find((name: string) => CLASS_IDS[name] === uid.resource) ??
            Object.keys(OBJECT_IDS).find((name: string) => OBJECT_IDS[name] === uid.resource) ??
            Object.keys(FUNCTION_IDS).find((name: string) => FUNCTION_IDS[name] === uid.resource)
        );
    }

    static isSystemResourceName(name: string): boolean {
        return name in ATOMIC_IDS || name in CLASS_IDS || name in OBJECT_IDS || name in FUNCTION_IDS;
    }

    static getClassNames(): readonly string[] {
        return Object.keys(CLASS_IDS);
    }

    static getObjectNames(): readonly string[] {
        return Object.keys(OBJECT_IDS);
    }

    static getFunctionNames(): readonly string[] {
        return Object.keys(FUNCTION_IDS);
    }

    static getClassRefByName(world: World, name: string): RefMsg<ClassMsg> | undefined {
        const uid = this.getUIDByName(world, name);
        return uid ? ClassMsg.createClassRefMsg(uid) : undefined;
    }

    static getClassMsgByName(world: World, name: string): ClassMsg | undefined {
        const uid = this.getUIDByName(world, name);
        return uid
            ? new ClassMsg(uid, {
                  name: name,
                  fields: [],
                  methods: [],
                  system_resource: false,
              })
            : undefined;
    }

    static getFunctionRefByName(world: World, name: string): RefMsg<FunctionMsg> | undefined {
        const uid = this.getUIDByName(world, name);
        return uid ? FunctionMsg.createFunctionRefMsg(uid) : undefined;
    }

    static getFunctionMsgByName(world: World, name: string): FunctionMsg | undefined {
        const uid = this.getUIDByName(world, name);
        return uid ? new FunctionMsg(uid) : undefined;
    }

    static getObjectMsgByName(world: World, name: string): ObjectMsg | undefined {
        const uid = this.getUIDByName(world, name);
        return uid ? new ObjectMsg(uid, {}) : undefined;
    }

    static createArrayClassMsg(world: World, uid: DefnUID, elementUuid?: DefnUID): ClassMsg {
        const base = this.getClassRefByName(world, 'Array');
        const elem = elementUuid ? ClassMsg.createClassRefMsg(elementUuid) : this.getClassRefByName(world, 'object')!;
        return new ClassMsg(uid, {
            name: 'Array__' + uid.resource.toString(),
            fields: [],
            methods: [],
            instance_of_generic: base!.uid,
            supplied_type_args: [{ name: 'elem', type: elem }],
            system_resource: false,
        });
    }

    static createSetClassMsg(world: World, uid: DefnUID, elementUuid?: DefnUID): ClassMsg {
        const base = this.getClassRefByName(world, 'Set');
        const elem = elementUuid ? ClassMsg.createClassRefMsg(elementUuid) : this.getClassRefByName(world, 'object')!;
        return new ClassMsg(uid, {
            name: 'Set__' + uid.resource.toString(),
            fields: [],
            methods: [],
            instance_of_generic: base!.uid,
            supplied_type_args: [{ name: 'elem', type: elem }],
            system_resource: false,
        });
    }

    static createMapClassMsg(world: World, uid: DefnUID, keyUuid?: DefnUID, valueUuid?: DefnUID): ClassMsg {
        const base = this.getClassRefByName(world, 'Map');
        const key = keyUuid ? ClassMsg.createClassRefMsg(keyUuid) : this.getClassRefByName(world, 'object')!;
        const value = valueUuid ? ClassMsg.createClassRefMsg(valueUuid) : this.getClassRefByName(world, 'object')!;
        return new ClassMsg(uid, {
            name: 'Map__' + uid.resource.toString(),
            fields: [],
            methods: [],
            instance_of_generic: base!.uid,
            supplied_type_args: [
                { name: 'key', type: key },
                { name: 'value', type: value },
            ],
            system_resource: false,
        });
    }

    static createRecordClassMsg(
        _world: World,
        uid: DefnUID,
        indexSignature: {
            key_type: RefMsg<ClassMsg>;
            value_type: RefMsg<ClassMsg>;
            map_type: RefMsg<ClassMsg>;
        }
    ): ClassMsg {
        return new ClassMsg(uid, {
            name: 'Record__' + uid.resource.toString(),
            fields: [],
            methods: [],
            index_signature: indexSignature,
            system_resource: false,
        });
    }

    static createTupleClassMsg(world: World, uid: DefnUID, elementUuids: DefnUID[]): ClassMsg {
        const base = this.getClassRefByName(world, 'Tuple');
        const typeArgs = elementUuids.map((elemUid, index) => ({
            name: index.toString(),
            type: ClassMsg.createClassRefMsg(elemUid),
        }));
        return new ClassMsg(uid, {
            name: 'Tuple__' + uid.resource.toString(),
            fields: [],
            methods: [],
            instance_of_generic: base!.uid,
            supplied_type_args: typeArgs,
            system_resource: false,
        });
    }

    static createLiteralClassMsg(
        world: World,
        uid: DefnUID,
        value: string | number | boolean,
        _valueType: 'string' | 'number' | 'boolean'
    ): ClassMsg {
        const base = this.getClassRefByName(world, 'Literal')!;
        let valueMsg: AtomMsg;
        switch (typeof value) {
            case 'string':
                valueMsg = new StrMsg(value);
                break;
            case 'number':
                valueMsg = Number.isInteger(value) ? new IntMsg(value) : new FloatMsg(value);
                break;
            case 'boolean':
                valueMsg = new BoolMsg(value);
                break;
            default:
                throw new Error(`Invalid value type: ${typeof value}`);
        }
        return new ClassMsg(uid, {
            name: 'Literal__' + uid.resource.toString(),
            fields: [],
            methods: [],
            instance_of_generic: base!.uid,
            supplied_type_args: [
                {
                    name: 'value',
                    type: valueMsg as any,
                },
            ],
            system_resource: false,
        });
    }

    static createEnumClassMsg(
        world: World,
        uid: DefnUID,
        keys: string[],
        values: (string | number)[],
        name?: string
    ): ClassMsg {
        const base = this.getClassRefByName(world, 'Enum');
        function makeEnumValueMsg(value: string | number): AtomMsg {
            switch (typeof value) {
                case 'string':
                    return new StrMsg(value);
                case 'number':
                    return Number.isInteger(value) ? new IntMsg(value) : new FloatMsg(value);
            }
        }
        return new ClassMsg(uid, {
            name: name ?? 'Enum__' + uid.resource.toString(),
            fields: [],
            methods: [],
            instance_of_generic: base!.uid,
            supplied_type_args: keys.map((key, index) => ({
                name: key,
                type: makeEnumValueMsg(values[index]) as any,
            })),
            system_resource: false,
        });
    }

    static createFutureClassMsg(world: World, uid: DefnUID, valueUuid?: DefnUID): ClassMsg {
        const base = this.getClassRefByName(world, 'Future');
        const value = valueUuid ? ClassMsg.createClassRefMsg(valueUuid) : this.getClassRefByName(world, 'object')!;
        return new ClassMsg(uid, {
            name: 'Future__' + uid.resource.toString(),
            fields: [],
            methods: [],
            instance_of_generic: base!.uid,
            supplied_type_args: [{ name: 'value', type: value }],
            system_resource: false,
        });
    }

    static createFunctionClassMsg(world: World, uid: DefnUID, functionMsg: FunctionMsg): ClassMsg {
        // describes type of function `(name: string) -> boolean`
        const base = this.getClassRefByName(world, 'Function');
        return new ClassMsg(uid, {
            name: 'FunctionType__' + uid.resource.toString(),
            fields: [],
            methods: [],
            instance_of_generic: base!.uid,
            supplied_type_args: functionMsg,
            system_resource: false,
        });
    }

    // Fallback when truncated, but potentially have info (at runtime)
    static createObjectClassMsg(world: World, uid: DefnUID, name?: string): ClassMsg {
        const base = this.getClassRefByName(world, 'Object');
        return new ClassMsg(uid, {
            // For no particular reason: keep the original name as part of the generic type
            name: 'Object_' + ((name ?? '').replace(/[^a-zA-Z0-9_]/g, '') || '') + '_' + uid.resource.toString(),
            fields: [],
            methods: [],
            instance_of_generic: base!.uid,
            supplied_type_args: [],
            system_resource: false,
        });
    }

    // Fallback when no info about class
    static createAnyClassMsg(world: World, _uid: DefnUID): ClassMsg {
        const base = this.getClassRefByName(world, 'Any');
        return new ClassMsg(base!.uid, {
            name: 'Any',
            fields: [],
            methods: [],
            system_resource: false,
        });
    }
}
