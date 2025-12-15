import type { MultiplexMessage, MultiplexServerMessage } from './types';

import { createLogger } from '@logging/index';

const logger = createLogger('session-manager:messages');

export function isServerMessage(message: MultiplexMessage): message is MultiplexServerMessage {
    return ['new_iid', 'data', 'error', 'invocation'].includes(message.type);
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Encode a multiplex message to JSON binary format (matches Python multiplex_to_json)
 */
export function encodeMessage(message: MultiplexMessage): Uint8Array {
    const prepared = { ...message };

    if ('warp_locals_payload' in prepared && prepared.warp_locals_payload instanceof Uint8Array) {
        const size = (prepared as any).warp_locals_payload.length;
        (prepared as any).warp_locals_payload = uint8ArrayToBase64((prepared as any).warp_locals_payload);
        logger.debug(`Encoded warp_locals_payload: ${size} bytes`);
    }
    if ('data' in prepared && prepared.data instanceof Uint8Array) {
        const size = prepared.data.length;
        (prepared as any).data = uint8ArrayToBase64(prepared.data);
        logger.debug(`Encoded data payload: ${size} bytes`);
    }

    const jsonString = JSON.stringify(prepared);
    return new TextEncoder().encode(jsonString);
}

/**
 * Decode JSON binary data to a multiplex message (matches Python multiplex_from_json)
 */
export function decodeMessage(data: Uint8Array): MultiplexMessage {
    try {
        const jsonString = new TextDecoder().decode(data);
        const decoded = JSON.parse(jsonString);

        const processed = { ...decoded };

        if (typeof processed.warp_locals_payload === 'string') {
            const bytes = base64ToUint8Array(processed.warp_locals_payload);
            processed.warp_locals_payload = bytes;
            logger.debug(`Decoded warp_locals_payload: ${bytes.length} bytes`);
        }
        if (typeof processed.data === 'string') {
            const bytes = base64ToUint8Array(processed.data);
            processed.data = bytes;
            logger.debug(`Decoded data payload: ${bytes.length} bytes`);
        }

        return processed as MultiplexMessage;
    } catch (error) {
        logger.error('Failed to decode message', error as Error);
        throw new Error(`Failed to decode message: ${error}`);
    }
}
