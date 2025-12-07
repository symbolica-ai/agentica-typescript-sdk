import { type ScopedLogger, createLogger } from '@logging/index';

import { Frame, FrameTree } from './frame';
import { UIDGenerator } from './frame-context/uid-gen';
import { ConceptMsg, DefMsg } from './msg-protocol/concept/concept';
import { FrameID, RPCKind, World, defnUidToString } from './msg-protocol/kinds';
import { ErrMsg, ResMsg, ResponseMsg } from './msg-protocol/rpc/response-msg';
import { FrameMuxSocket } from './rpc-channel/mux';

const ROOT_FRAME_ID = 0;

export class FrameRuntime {
    public world: World;
    public remoteFrameCounter: FrameID;
    public localFrameTree: FrameTree;
    public remoteParents: Map<FrameID, FrameID> = new Map();
    public remoteChildren: Map<FrameID, Set<FrameID>> = new Map();
    public socket?: FrameMuxSocket;
    public uidGenerator: UIDGenerator;
    public logger: ScopedLogger;
    public uid: string | undefined;
    public iid: string | undefined;
    public createdAt: number;

    // Track which definition UIDs have been sent to which remote frame
    private sentDefsByRemote: Map<FrameID, Set<string>> = new Map();

    constructor(world: World = World.Client, parentLogger?: ScopedLogger) {
        this.world = world;
        this.logger = parentLogger?.withScope(`runtime`) ?? createLogger(`runtime`);
        this.remoteFrameCounter = ROOT_FRAME_ID;
        this.remoteParents.set(ROOT_FRAME_ID, ROOT_FRAME_ID);
        this.remoteChildren.set(ROOT_FRAME_ID, new Set());
        this.uidGenerator = new UIDGenerator(this.world);
        this.localFrameTree = new FrameTree();
        this.localFrameTree.push(undefined, new Frame(this, ROOT_FRAME_ID));
        this.logger.debug(`Initialized runtime with root frame ${ROOT_FRAME_ID}`);
        this.createdAt = Date.now();
    }

    setUid(uid: string | undefined) {
        this.uid = uid;
    }

    setIid(iid: string | undefined) {
        this.iid = iid;
    }

    get elapsedTimeInSeconds(): number {
        return (Date.now() - this.createdAt) / 1000;
    }

    get rootFrame(): Frame {
        return this.localFrameTree.frames.get(ROOT_FRAME_ID)!;
    }

    get otherWorld(): World {
        return this.world === World.Client ? World.Server : World.Client;
    }

    incrementRemoteFrameCounter(): FrameID {
        return ++this.remoteFrameCounter;
    }

    /*
     * Opening requests remotely or locally
     */

    // We want to request a new frame on the remote (track parentage) for a specific local frame
    newRemoteFrameForLocalRequest(localFrameID: FrameID): number {
        const remoteFrameId = this.incrementRemoteFrameCounter();
        let remoteRequests = this.remoteChildren.get(localFrameID);
        if (!remoteRequests) {
            remoteRequests = new Set<FrameID>();
            this.remoteChildren.set(localFrameID, remoteRequests);
        }
        remoteRequests.add(remoteFrameId);
        this.logger.debug(`New remote frame ${remoteFrameId} for local ${localFrameID}`);
        return remoteFrameId;
    }

    // A new request came in, which we handle in a new frame
    newLocalFrameForRemoteRequest(
        localParentID: FrameID,
        requestedLocalID: FrameID,
        requestingRemoteID: FrameID
    ): Frame {
        const localParentFrame = this.localFrameTree.frames.get(localParentID);
        if (!localParentFrame) {
            this.logger.error(`Unknown parent frame ${localParentID}`);
            throw new Error('Unknown parent frame');
        }
        this.remoteParents.set(requestedLocalID, requestingRemoteID);
        this.remoteChildren.set(requestedLocalID, new Set([]));
        const newFrame = new Frame(this, requestedLocalID, localParentFrame);
        this.localFrameTree.push(localParentID, newFrame);
        this.logger.debug(
            `New local frame ${requestedLocalID} (parent=${localParentID}, remote=${requestingRemoteID})`
        );
        return newFrame;
    }

    /*
     * Closing requests
     */

    // A remote request frame has returned; remove it from the set of outstanding remote frames
    returnFromRemoteFrame(localID: FrameID, remoteID: FrameID): void {
        const children = this.remoteChildren.get(localID);
        if (!children || !children.has(remoteID)) {
            this.logger.error(`Trying to return from unknown remote frame ${remoteID}`);
            throw new Error('Trying to return from unknown remote frame');
        }
        children.delete(remoteID);
        this.logger.debug(`Returned from remote frame ${remoteID} (local=${localID})`);
    }

    // Close local request, persist/return the result to the local frame's local parent
    // so that the remote parent frame can keep using it.
    returnContextFromLocalFrame(localID: FrameID, response: ResponseMsg): DefMsg[] {
        const span = this.logger.startSpan(`returnFromLocalFrame-${localID}`);
        try {
            const localFrame = this.localFrameTree.frames.get(localID);
            if (!localFrame) {
                this.logger.error(`Trying to return from unknown local frame ${localID}`);
                throw new Error('Trying to return from unknown local frame');
            }
            const outstanding = this.remoteChildren.get(localID);
            if (outstanding && outstanding.size > 1) {
                this.logger.error(
                    `Returning from local frame ${localID} with ${outstanding.size} outstanding remote frames`
                );
                throw new Error('Returning from local frame with outstanding remote frames');
            }

            const new_defs: DefMsg[] = [];
            switch (response.kind) {
                case RPCKind.Response.Ok:
                    this.logger.debug(`Frame ${localID} returned OK`);
                    break;
                case RPCKind.Response.Err: {
                    this.logger.warn(
                        `Frame ${localID} returned an error with the following payload:`,
                        (response as ErrMsg).payload.error
                    );
                    break;
                }
                case RPCKind.Response.Res: {
                    const result: ConceptMsg = (response as ResMsg).payload.result;
                    localFrame.parentFrame?.passContextFromOtherFrame(localFrame, result, new_defs);
                    this.logger.debug(`Frame ${localID} returned result with ${new_defs.length} new defs`);
                    span.setAttribute('new_defs_count', new_defs.length);
                    break;
                }
            }
            this.localFrameTree.pop(localID);
            this.remoteParents.delete(localID);
            this.remoteChildren.delete(localID);
            return new_defs;
        } catch (error) {
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    /*
     * Sent-defs tracking
     */

    private getOrInitSentSet(remoteFID: FrameID): Set<string> {
        let set = this.sentDefsByRemote.get(remoteFID);
        if (!set) {
            set = new Set<string>();
            this.sentDefsByRemote.set(remoteFID, set);
        }
        return set;
    }

    filterUnsentLocalDefs(remoteFID: FrameID, defs: DefMsg[]): DefMsg[] {
        const sent = this.getOrInitSentSet(remoteFID);
        const filtered: DefMsg[] = [];
        for (const def of defs) {
            // Only send defs that belong to our local world
            if (def.uid.world !== this.world) continue;
            const key = defnUidToString(def.uid);
            if (sent.has(key)) continue;
            filtered.push(def);
        }
        return filtered;
    }

    markDefsSent(remoteFID: FrameID, defs: DefMsg[]): void {
        const sent = this.getOrInitSentSet(remoteFID);
        for (const def of defs) {
            sent.add(defnUidToString(def.uid));
        }
    }
}
