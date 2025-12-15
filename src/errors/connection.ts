import { AgenticaError } from './base';

/** Base class for connection errors. */
export class ConnectionError extends AgenticaError {
    constructor(message: string) {
        super(message);
    }
}

/** WebSocket connection error. */
export class WebSocketConnectionError extends ConnectionError {
    constructor(message: string) {
        super(message);
    }
}

/** WebSocket timeout error. */
export class WebSocketTimeoutError extends ConnectionError {
    constructor(message: string) {
        super(message);
    }
}

/** Raised when the SDK version is no longer supported by the server. */
export class SDKUnsupportedError extends AgenticaError {
    constructor(message: string) {
        super(message);
    }
}

/** Raised when the client and server are out of sync and cannot be recovered. */
export class ClientServerOutOfSyncError extends AgenticaError {
    constructor(message: string) {
        super(message);
    }
}
