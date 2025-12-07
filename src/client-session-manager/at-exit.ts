/**
 * Platform-agnostic cleanup handler for async resources at shutdown.
 *
 * Supports:
 * - Node.js: process.on('SIGTERM', 'SIGINT', 'beforeExit')
 * - Browser: window.addEventListener('beforeunload')
 */

import { createLogger } from '@logging/index';

const logger = createLogger('at-exit');

type AsyncCleanupCallback = () => Promise<void>;
type SyncCleanupCallback = () => void;

interface CleanupEntry {
    objRef: WeakRef<any>;
    asyncCallback: AsyncCleanupCallback;
    syncFallback?: SyncCleanupCallback;
}

const cleanupEntries: CleanupEntry[] = [];
let cleanupDone = false;
const knownResources = new WeakSet<any>();

/**
 * Register cleanup callbacks to be called at process/page shutdown.
 * @param obj - The object to track (weak reference)
 * @param asyncCallback - Async cleanup function (used when event loop is healthy)
 * @param syncFallback - Optional sync fallback (used when async fails)
 */
export function registerCleanup(
    obj: any,
    asyncCallback: AsyncCleanupCallback,
    syncFallback?: SyncCleanupCallback
): void {
    if (knownResources.has(obj)) {
        logger.warn(`Resource ${obj.constructor?.name || obj} already registered for cleanup. Ignoring.`);
        return;
    }
    knownResources.add(obj);

    cleanupEntries.push({
        objRef: new WeakRef(obj),
        asyncCallback,
        syncFallback,
    });

    registerExitHandlers();
}

// Backwards compatibility
export const registerAsyncCleanup = registerCleanup;

let exitHandlersRegistered = false;

function registerExitHandlers(): void {
    if (exitHandlersRegistered) {
        return;
    }

    const isNode = typeof process !== 'undefined' && process.versions?.node;
    const isBrowser = typeof window !== 'undefined';

    if (isNode) {
        // SIGINT (Ctrl+C) - run async cleanup, then exit
        process.on('SIGINT', async () => {
            logger.debug('SIGINT received (Ctrl+C), running cleanup');
            await runAsyncCleanup();
            process.exit(130);
        });

        // SIGTERM - run async cleanup, then exit
        process.on('SIGTERM', async () => {
            logger.debug('SIGTERM received, running cleanup');
            await runAsyncCleanup();
            process.exit(128 + 15);
        });

        // beforeExit - runs when event loop is empty, async still works
        process.on('beforeExit', async () => {
            logger.debug('beforeExit event, running cleanup');
            await runAsyncCleanup();
        });

        // exit - sync only, last resort
        process.on('exit', () => {
            logger.debug('exit event, running sync fallback cleanup');
            runSyncFallback();
        });
    } else if (isBrowser) {
        // Browser: beforeunload is our best bet
        window.addEventListener('beforeunload', () => {
            logger.debug('Browser beforeunload, running sync cleanup');
            runSyncFallback();
        });

        // Page hidden - precautionary cleanup
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                logger.debug('Page hidden, running sync cleanup as precaution');
                runSyncFallback();
            }
        });
    }

    exitHandlersRegistered = true;
    logger.debug('Cleanup handlers registered');
}

async function runAsyncCleanup(): Promise<void> {
    if (cleanupDone) {
        return;
    }

    const activeEntries = cleanupEntries.filter((e) => e.objRef.deref() !== undefined);

    if (activeEntries.length === 0) {
        cleanupDone = true;
        return;
    }

    logger.debug(`Running async cleanup for ${activeEntries.length} resource(s)`);

    for (const entry of activeEntries) {
        const obj = entry.objRef.deref();
        if (obj) {
            try {
                await entry.asyncCallback();
                logger.debug(`Cleanup completed for ${obj.constructor?.name || 'unknown'}`);
            } catch (error) {
                logger.error(`Async cleanup failed for ${obj.constructor?.name}:`, error as Error);
                // Try sync fallback
                if (entry.syncFallback) {
                    try {
                        entry.syncFallback();
                    } catch (syncError) {
                        logger.error(`Sync fallback also failed:`, syncError as Error);
                    }
                }
            }
        }
    }

    cleanupEntries.length = 0;
    cleanupDone = true;
}

function runSyncFallback(): void {
    if (cleanupDone) {
        return;
    }

    const activeEntries = cleanupEntries.filter((e) => e.objRef.deref() !== undefined);

    if (activeEntries.length === 0) {
        cleanupDone = true;
        return;
    }

    logger.debug(`Running sync fallback cleanup for ${activeEntries.length} resource(s)`);

    for (const entry of activeEntries) {
        const obj = entry.objRef.deref();
        if (obj && entry.syncFallback) {
            try {
                entry.syncFallback();
                logger.debug(`Sync cleanup completed for ${obj.constructor?.name || 'unknown'}`);
            } catch (error) {
                logger.error(`Sync cleanup failed for ${obj.constructor?.name}:`, error as Error);
            }
        }
    }

    cleanupEntries.length = 0;
    cleanupDone = true;
}
