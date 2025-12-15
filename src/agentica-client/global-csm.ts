import { getAgenticaApiKey, getAgenticaBaseUrl, getSessionManagerBaseUrl } from '@bundlers/utils';
import { ClientSessionManager } from '@client-session-manager/client-session-manager';
import { createLogger } from '@logging/index';

import { Agentica } from './agentica-client';
import { httpToWs } from './utils';

const logger = createLogger('global-csm');

let GLOBAL_AGENTICA_SM: ClientSessionManager | null = null;
const DEFAULT_BASE_URL = 'https://api.platform.symbolica.ai';

/**
 * Environment-based connection management
 * - If AGENTICA_API_KEY is set, use the platform service
 * - Otherwise, use the session manager directly
 */
export async function getGlobalSessionManager(): Promise<ClientSessionManager> {
    if (GLOBAL_AGENTICA_SM) {
        return GLOBAL_AGENTICA_SM;
    }

    const apiKey = getAgenticaApiKey();
    if (apiKey) {
        logger.debug('Found API key in environment');
        const baseUrl = getAgenticaBaseUrl() || DEFAULT_BASE_URL;
        logger.debug(`Using platform service, base_url=${baseUrl}`);
        const client = new Agentica(baseUrl, apiKey);
        GLOBAL_AGENTICA_SM = await client.createSessionManager();
        return GLOBAL_AGENTICA_SM;
    }

    const sessionManagerBaseUrl = getSessionManagerBaseUrl() || 'http://localhost:2345';
    logger.debug(`Using session manager, base_url=${sessionManagerBaseUrl}`);

    GLOBAL_AGENTICA_SM = new ClientSessionManager({});
    GLOBAL_AGENTICA_SM.setEndpoints(sessionManagerBaseUrl, httpToWs(sessionManagerBaseUrl));
    return GLOBAL_AGENTICA_SM;
}

/**
 * Get uid from iid
 */
export function getUidForIid(iid: string, sm?: ClientSessionManager): string | undefined {
    return (sm ?? GLOBAL_AGENTICA_SM)?.getUidForIid(iid);
}

/**
 * Sentinel for agent call id (substituted at runtime)
 */
export const AGENTICA_CALL_ID = 'AGENTICA_AGENT_CALL_ID';

/**
 * Sentinel for agent's elapsed time (substituted at runtime)
 */
export const AGENTICA_ELAPSED_TIME = 'AGENTICA_AGENT_ELAPSED_TIME';
