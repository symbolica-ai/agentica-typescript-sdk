import type { ScopedLogger } from '@logging/index';
import type { CompiledConceptContext } from '@transformer/processor/processor-utils';

import { FrameContext, UIDGenerator } from './frame-context/frame-ctx';
import { TermDecoder } from './frame-context/message-conversion/decoder';
import { TermEncoder } from './frame-context/message-conversion/encoder';
import { SyntheticsFactory } from './frame-context/synthetic-resources/factory';
import { SystemFrameContext } from './frame-context/system-ctx';
import { DefaultVirtualizer } from './frame-context/virtual-resources/default';
import { DefaultVirtualDispatcher } from './frame-context/virtual-resources/dispatcher';
import { VirtualDispatcher, Virtualizer } from './frame-context/virtual-resources/virtualizer';
import { AnnotationMsg, InterfaceMsg, MethodSignatureMsg } from './msg-protocol/concept/annotations/annotation-msg';
import { ConceptMsg, DefMsg, RefMsg, Term, TermMsg, equalUid } from './msg-protocol/concept/concept';
import { rehydrateMsg } from './msg-protocol/concept/rehydrate';
import { ClassMsg, TypeArgument } from './msg-protocol/concept/resource/class-msg';
import { FunctionMsg } from './msg-protocol/concept/resource/function-msg';
import { ObjectMsg } from './msg-protocol/concept/resource/object-msg';
import { ArrayMsg, MapMsg, SetMsg, TupleMsg } from './msg-protocol/concept/value/container';
import { ConceptKind, DefnUID, FrameID } from './msg-protocol/kinds';
import { RpcHandler } from './rpc-channel/handler';
import { FrameRuntime } from './runtime';

import { throwNoBareFutures } from '@/coming-soon';

export class FrameTree {
    public frames: Map<FrameID, Frame>;
    public childMap: Map<FrameID, Set<FrameID>>;
    public parentMap: Map<FrameID, FrameID>;

    constructor() {
        this.frames = new Map();
        this.childMap = new Map();
        this.parentMap = new Map();
    }

    push(parentFrameID: FrameID | undefined, frame: Frame): void {
        this.frames.set(frame.frameID, frame);
        if (parentFrameID) {
            const children = this.childMap.get(parentFrameID);
            if (!children) {
                this.childMap.set(parentFrameID, new Set([frame.frameID]));
            } else {
                children.add(frame.frameID);
            }
            this.parentMap.set(frame.frameID, parentFrameID);
        }
    }

    pop(frameID: FrameID): Frame | undefined {
        const frame = this.frames.get(frameID);
        if (!frame) {
            return undefined;
        }
        this.frames.delete(frameID);
        const parentFrameID = this.parentMap.get(frameID);
        if (parentFrameID) {
            this.childMap.get(parentFrameID)?.delete(frameID);
        }
        this.parentMap.delete(frameID);
        return frame;
    }
}

export class Frame {
    public readonly frameID: FrameID;
    public readonly parentFrame?: Frame;
    public readonly encodingDepth: number = 3;
    public replBuffer: Map<string, TermMsg> = new Map();
    public context: FrameContext;

    public conceptEncoder: TermEncoder;
    public conceptDecoder: TermDecoder;
    public uidGenerator: UIDGenerator;
    public dispatcher: VirtualDispatcher;
    public virtualizer: Virtualizer;
    public syntheticsFactory: SyntheticsFactory;

    public runtime: FrameRuntime;
    public rpcHandler: RpcHandler;
    public logger: ScopedLogger;

    constructor(runtime: FrameRuntime, frameID: FrameID, parent?: Frame) {
        this.runtime = runtime;
        this.frameID = frameID;
        this.parentFrame = parent;
        this.logger = runtime.logger.withScope(`frame-${frameID}`);

        // The core of a frame: definition context
        const parentCtx = parent?.context || new SystemFrameContext(this.runtime.uidGenerator);
        this.uidGenerator = parentCtx.uidGenerator.share();

        this.context = FrameContext.newFromParent(parentCtx, this.frameID, this.uidGenerator);

        // Encoding/decoding + virtualization
        this.rpcHandler = new RpcHandler(this);
        this.dispatcher = new DefaultVirtualDispatcher(this);
        this.dispatcher.setRpcHandler(this.rpcHandler);
        this.virtualizer = new DefaultVirtualizer(this.dispatcher);
        this.syntheticsFactory = new SyntheticsFactory(this.context);
        this.conceptEncoder = new TermEncoder(this.context);
        this.conceptDecoder = new TermDecoder(this.virtualizer, this.context);
        this.logger.debug(`Frame ${frameID} initialized (parent=${parent?.frameID ?? 'none'})`);
    }

    toMsg(concept: Term): TermMsg {
        const message = this.conceptEncoder.encodeWithCtx(concept, this.encodingDepth);
        return message;
    }

    fromMsg(msg: TermMsg): Term {
        return this.conceptDecoder.decodeWithCtx(msg);
    }

    generateUID(): DefnUID {
        return this.uidGenerator.next();
    }

    ingestLocals(compilerContext: CompiledConceptContext): void {
        const span = this.logger.startSpan(`ingestLocals-${this.frameID}`);
        try {
            const classes: Map<DefnUID, [ClassMsg, string, any]> = new Map();
            const functions: Map<DefnUID, [FunctionMsg, string, any]> = new Map();
            const objects: Map<DefnUID, [ObjectMsg, string, any]> = new Map();
            const annotations: Map<DefnUID, [AnnotationMsg, string]> = new Map();
            const synthetics: DefnUID[] = [];

            // Step 0: parse the context and reconstruct resources
            const parsedContext: Map<DefnUID, [DefMsg, string, any]> = new Map();
            for (const [uidAsString, entry] of Object.entries(compilerContext)) {
                // Parsing
                const uid: DefnUID = {
                    world: this.runtime.world,
                    resource: parseInt(uidAsString),
                };
                this.uidGenerator.setmin(uid.resource);
                let resource;
                try {
                    resource = (entry as any).defGetter ?? undefined;
                } catch (error) {
                    this.logger.error(`Error getting resource for ${uidAsString}: ${error}`);
                    resource = undefined;
                }
                const parsedMsg = JSON.parse(entry.defMsg);
                const rehydratedMsg = parsedMsg.kind ? rehydrateMsg(parsedMsg) : parsedMsg; // kind should exist
                parsedContext.set(uid, [rehydratedMsg, entry.defName, resource]);
            }

            // Step 1: Reconstruct resources and sort by kind
            for (const [uid, [msg, name, resource]] of parsedContext) {
                let kind = ConceptKind.fromStr(msg.kind);
                if (!kind) {
                    this.logger.warn(`Unsupported kind: ${msg.kind}`);
                    continue;
                }

                // Resource reconstruction
                let updatedResource = resource;
                let updatedMsg = msg;
                if (!resource) {
                    // Generics (like Person[]) -> synthetic generic resource
                    if (kind === ConceptKind.Resource.Cls) {
                        if (updatedMsg.payload?.instance_of_generic) {
                            updatedResource = this.syntheticsFactory.createSyntheticGenericType(
                                updatedMsg as ClassMsg,
                                updatedMsg.payload.instance_of_generic,
                                updatedMsg.payload.type_args ?? []
                            );
                            this.logger.debug(`Created synthetic generic for ${name}`);
                        } else {
                            // Found a non-generic class without resource -> demote to interface!
                            updatedMsg = ClassMsg.createInterfaceMsg(uid, updatedMsg.payload);
                            kind = ConceptKind.Annotation.Interface;
                            this.logger.debug(
                                `Converting non-generic class ${name} to interface (setting kind=${kind})`
                            );
                        }
                    }

                    // Interfaces -> synthetic runtime class resource only (do not emit as ClassMsg def)
                    if (kind === ConceptKind.Annotation.Interface) {
                        const { ctor: syntheticClass, msgUp } = this.syntheticsFactory.createSyntheticClassForInterface(
                            updatedMsg as InterfaceMsg,
                            name
                        );
                        updatedResource = syntheticClass;

                        // Some interfaces get promoted to classes
                        if (msgUp) {
                            synthetics.push(uid);
                            updatedMsg = msgUp;
                            kind = ConceptKind.Resource.Cls;
                        }

                        this.logger.debugObject(
                            `Created synthetic class for interface ${name} promoted to class?`,
                            msgUp ? msgUp : 'no'
                        );
                    }

                    // Intersections -> synthetic runtime class resource only (may emit as ClassMsg def)
                    if (kind === ConceptKind.Annotation.Intersection) {
                        updatedResource = this.syntheticsFactory.createSyntheticClassForIntersection(updatedMsg, name);

                        this.logger.debug(`Created synthetic class for intersection ${name}`);
                    }
                }

                // Sort by kind
                switch (kind) {
                    case ConceptKind.Resource.Cls:
                        classes.set(uid, [updatedMsg as ClassMsg, name, updatedResource]);
                        break;
                    case ConceptKind.Resource.Func:
                        functions.set(uid, [updatedMsg as FunctionMsg, name, updatedResource]);
                        break;
                    case ConceptKind.Resource.Obj:
                        objects.set(uid, [updatedMsg as ObjectMsg, name, updatedResource]);
                        break;
                    case ConceptKind.Annotation.Union:
                    case ConceptKind.Annotation.Intersection:
                    case ConceptKind.Annotation.MemberSig:
                    case ConceptKind.Annotation.Interface:
                        annotations.set(uid, [updatedMsg as AnnotationMsg, name]);
                        break;
                }
            }

            // Step: 2: Process by kind
            this.logger.debug(
                `Ingesting: ${classes.size} classes, ${functions.size} functions, ${objects.size} objects, ${annotations.size} annotations`
            );

            // Process constructor objects (classes)
            for (const [uid, [clsMsg, name, resource]] of classes) {
                this.logger.debug(`Ingesting class ${name} with uid ${uid.resource}`);
                this.context.classes.setRecord(uid, resource, clsMsg);
                this.setLocal(name, clsMsg);
            }

            // Process annotations
            for (const [uid, [annMsg, name]] of annotations) {
                this.logger.debug(`Ingesting annotation ${name} with uid ${uid.resource}`);
                this.context.annotations.setRecord(uid, annMsg as AnnotationMsg);
                this.setLocal(name, annMsg);
            }

            // Process function objects
            for (const [uid, [funcMsg, name, resource]] of functions) {
                this.logger.debug(`Ingesting function ${name} with uid ${uid.resource}`);
                this.context.functions.setRecord(uid, resource, funcMsg);
                this.setLocal(name, funcMsg);
            }

            // Process objects
            for (const [uid, [objMsg, name, resource]] of objects) {
                const clsMsg = this.context.getMessageFromUID(objMsg.payload.cls!.uid) as
                    | ClassMsg
                    | AnnotationMsg
                    | undefined;
                const isSyntheticClass = !!clsMsg && synthetics.includes(clsMsg.uid);

                this.logger.debug(
                    `Ingesting object ${name} with uid ${uid.resource} of type ${clsMsg?.kind} where function? ${clsMsg?.isFunction()}, annotation? ${clsMsg?.isAnnotation()}, synthetic class? ${isSyntheticClass}, container? ${clsMsg?.isContainer()}, primitive? ${clsMsg?.isPrimitive()}, literal? ${clsMsg?.isLiteral()}, object? ${clsMsg?.isObject()}`
                );

                // Case function: Turn into an actual FunctionMsg
                if (clsMsg?.isFunction()) {
                    const embeddedFuncMsg = (clsMsg as ClassMsg).payload.supplied_type_args as FunctionMsg;
                    const funcMsg = new FunctionMsg(uid, {
                        ...embeddedFuncMsg.payload,
                        is_top_level: objMsg.payload?.is_top_level,
                    });
                    funcMsg.payload.name = name;
                    this.context.functions.setRecord(uid, resource, funcMsg);
                    this.setLocal(name, funcMsg);

                    // Assumption: actual function objects : function types = 1 : 1 ... only need former
                    const functionTypeName = clsMsg.payload.name ?? '';
                    if (this.replBuffer.has(functionTypeName)) {
                        this.replBuffer.delete(functionTypeName); // leave in context for now, no harm
                    }

                    this.logger.debug(`Converted function object ${name} to FunctionMsg`);
                }

                // Case annotation (or synthetic class): Re-encode to use the actual class of the object
                else if (clsMsg?.isAnnotation() || isSyntheticClass) {
                    const nestedDefs: DefMsg[] = [];
                    const actualMsg = this.conceptEncoder.tryEncodeAnnotatedObject(
                        resource,
                        uid,
                        this.encodingDepth,
                        nestedDefs,
                        clsMsg as AnnotationMsg,
                        isSyntheticClass
                    );
                    if (actualMsg) {
                        let nestedDefCounter = 0;
                        for (const def of nestedDefs) {
                            this.setLocal(`__${name}_Def${nestedDefCounter}`, def);
                            nestedDefCounter++;
                        }
                        this.context.objects.setRecord(uid, resource, actualMsg); // redundant
                        this.setLocal(name, actualMsg);
                        this.logger.debug(`Re-encoded annotation ${name} with ${nestedDefs.length} nested defs`);
                    }
                }

                // Case container/primitive: Encode the actual object, do NOT set record
                else if (clsMsg?.isContainer() || clsMsg?.isPrimitive() || clsMsg?.isLiteral()) {
                    const nestedDefs: DefMsg[] = [];
                    const actualMsg = this.conceptEncoder.encodeWithCtx(
                        resource,
                        this.encodingDepth,
                        nestedDefs,
                        clsMsg as ClassMsg
                    );
                    let nestedObjCounter = 0;
                    for (const def of nestedDefs) {
                        this.setLocal(`__${name}_auxiliaryDef_${nestedObjCounter}`, def);
                        nestedObjCounter++;
                    }
                    this.logger.debug(`Encoded container/primitive ${name} with ${nestedDefs.length} nested defs`);
                    // omit setting a resource record!!
                    this.setLocal(name, actualMsg); // but do set the local
                }

                // Case future object: unsupported for now!
                else if (clsMsg?.isFuture()) {
                    throwNoBareFutures();
                }

                // Case Any or Object: best effort is to re-encode!
                else if (clsMsg?.isAny() || clsMsg?.isObject()) {
                    const nestedDefs: DefMsg[] = [];
                    const actualMsg = this.conceptEncoder.encodeObject(
                        resource,
                        uid,
                        this.encodingDepth,
                        undefined,
                        nestedDefs
                    );
                    let nestedObjCounter = 0;
                    for (const def of nestedDefs) {
                        this.setLocal(`__${name}_auxiliaryDef_${nestedObjCounter}`, def);
                        nestedObjCounter++;
                    }
                    this.logger.debug(`Re-encoded Any object ${name} with ${nestedDefs.length} nested defs`);
                    if (ConceptKind.isResourceMsg(actualMsg)) {
                        this.context.objects.setRecord(uid, resource, actualMsg);
                    }
                    this.setLocal(name, actualMsg);
                }

                // Case regular object: Set record
                else {
                    this.context.objects.setRecord(uid, resource, objMsg);
                    this.setLocal(name, objMsg);
                }
            }

            this.logger.debug(`Ingested ${this.replBuffer.size} locals`);
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    setLocal(name: string, msg: TermMsg): void {
        if (this.replBuffer.has(name)) {
            const existing = this.replBuffer.get(name);

            // Check if it's the same resource (by UID) - if so, skip duplicate
            if (
                existing &&
                'uid' in existing &&
                'uid' in msg &&
                existing.uid.world === msg.uid.world &&
                existing.uid.resource === msg.uid.resource
            ) {
                this.logger.debug(`Skipping duplicate local ${name} with same UID ${msg.uid.resource}`);
                return;
            }
            // Different resource with same name - create overload
            const overload_name = `${name}_overload${this.replBuffer.size}`;
            this.logger.warn(`Local ${name} already exists with different UID, using ${overload_name}`);
            this.replBuffer.set(overload_name, msg);
        } else {
            this.replBuffer.set(name, msg);
        }
    }

    resetReplBuffer(): void {
        this.replBuffer.clear();
    }

    passContextFromRemoteDefs(msgs: DefMsg[]): void {
        /*
         * If a remote sends us some defs, we need to add them to our context
         */
        for (const msg of msgs) {
            this.conceptDecoder.decodeWithCtx(msg);
        }
    }

    passContextFromOtherFrame(other: Frame, msg: ConceptMsg, defs?: DefMsg[]): void {
        /*
         * If another frame returns to us, then we needs to keep some of its
         * concepts in our frame... walk defs recursively!
         */
        this.logger.debug(`Passing context from other frame: ${msg.kind}`);

        if (!!(msg as DefMsg | RefMsg<DefMsg>).uid && !!this.context.getMessageFromUID((msg as DefMsg).uid)) {
            // We already know about this concept
            return;
        }

        this.logger.debug(`Passing context from other frame: ${msg.kind} - dereferencing`);

        // Dereference
        if (msg.kind === ConceptKind.Reference.Ref) {
            const cachedMsg = other.context.getMessageFromUID((msg as RefMsg<DefMsg>).uid);
            if (!cachedMsg) {
                throw new Error('got uncached ref msg');
            }
            msg = cachedMsg;
            defs?.push(msg as DefMsg);
        }

        // Recursive depending on message kind
        const kind = msg.kind;
        switch (kind) {
            case ConceptKind.Annotation.MemberSig: {
                const uid = (msg as FunctionMsg).uid;
                this.context.annotations.setRecord(uid, msg as MethodSignatureMsg);
                if (defs && !defs.some((def) => equalUid(def.uid, uid))) {
                    defs.push(msg as DefMsg);
                }
                break;
            }
            case ConceptKind.Resource.Func: {
                const uid = (msg as FunctionMsg).uid;
                const func = other.context.getResourceFromUID(uid);
                this.context.functions.setRecord(uid, func, msg as FunctionMsg);
                if (defs && !defs.some((def) => equalUid(def.uid, uid))) {
                    defs.push(msg as DefMsg);
                }
                break;
            }
            case ConceptKind.Resource.Obj: {
                const uid = (msg as ObjectMsg).uid;
                const obj = other.context.getResourceFromUID(uid);
                this.context.objects.setRecord(uid, obj, msg as ObjectMsg);
                if (defs && !defs.some((def) => equalUid(def.uid, uid))) {
                    defs.push(msg as DefMsg);
                }
                // Recurse to object's class
                if ((msg as ObjectMsg).payload?.cls) {
                    this.passContextFromOtherFrame(other, (msg as ObjectMsg).payload.cls!, defs);
                }
                break;
            }
            case ConceptKind.Resource.Cls: {
                const uid = (msg as ClassMsg).uid;
                const cls = other.context.getResourceFromUID(uid);
                this.context.classes.setRecord(uid, cls, msg as ClassMsg);
                if (defs && !defs.some((def) => equalUid(def.uid, uid))) {
                    defs.push(msg as DefMsg);
                }
                // Recurse into methods
                for (const method of (msg as ClassMsg).payload?.methods ?? []) {
                    this.passContextFromOtherFrame(other, method.function, defs);
                }
                // Recurse into bases
                for (const base of (msg as ClassMsg).payload?.bases ?? []) {
                    this.passContextFromOtherFrame(other, base, defs);
                }
                // Recurse into type args
                if (Array.isArray((msg as ClassMsg).payload?.supplied_type_args)) {
                    for (const arg of (msg as ClassMsg).payload?.supplied_type_args as TypeArgument[]) {
                        this.passContextFromOtherFrame(other, arg.type, defs);
                    }
                }
                // TODO: recurse into ctor args etc. ... or uniformize the recursive reference crawling for all messages :-)
                break;
            }
            case ConceptKind.Container.Set:
            case ConceptKind.Container.Array:
            case ConceptKind.Container.Tuple: {
                for (const item of (msg as ArrayMsg | TupleMsg | SetMsg).val) {
                    const derefedItem = other.context.derefValueOrMsg(item);
                    this.passContextFromOtherFrame(other, derefedItem, defs);
                }
                break;
            }
            case ConceptKind.Container.Map: {
                const items = [...(msg as MapMsg).val.keys, ...(msg as MapMsg).val.vals];
                this.logger.debug(`Passing context from other frame: ${kind} - ${items.length} items`);
                for (const item of items) {
                    const derefedItem = other.context.derefValueOrMsg(item);
                    this.passContextFromOtherFrame(other, derefedItem, defs);
                }
                break;
            }
            case ConceptKind.Annotation.Union:
            case ConceptKind.Annotation.Intersection:
            case ConceptKind.Annotation.Interface:
                throw new Error('Cannot ingest non-value types at runtime');
            case ConceptKind.Atom.Bool:
            case ConceptKind.Atom.Int:
            case ConceptKind.Atom.Float:
            case ConceptKind.Atom.Str:
            case ConceptKind.Atom.Bytes:
            case ConceptKind.Atom.None:
                // Nothing to do
                this.logger.debug(`Passing context from other frame: ${kind} - nothing to do`);
                break;
        }
    }
}
