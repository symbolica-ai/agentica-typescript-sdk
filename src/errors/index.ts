import { AgenticaError } from './base';
import { ThisIsABug } from './bugs';
import {
    ClientServerOutOfSyncError,
    ConnectionError,
    SDKUnsupportedError,
    WebSocketConnectionError,
    WebSocketTimeoutError,
} from './connection';
import { ServerError } from './generation';
import {
    APIConnectionError,
    APITimeoutError,
    BadRequestError,
    ConflictError,
    ContentFilteringError,
    DeadlineExceededError,
    GenerationError,
    InferenceError,
    InsufficientCreditsError,
    InternalServerError,
    MaxRoundsError,
    MaxTokensError,
    NotFoundError,
    OverloadedError,
    PermissionDeniedError,
    RateLimitError,
    RequestTooLargeError,
    ServiceUnavailableError,
    UnauthorizedError,
    UnprocessableEntityError,
    UsageError,
} from './generation';
import { InvocationError, NotRunningError, TooManyInvocationsError } from './invocation';

import { MultiplexErrorMessage } from '@/client-session-manager/types';

export { AgenticaError, enrichError } from './base';

export {
    APIConnectionError,
    APITimeoutError,
    BadRequestError,
    ConflictError,
    ContentFilteringError,
    DeadlineExceededError,
    GenerationError,
    InferenceError,
    InsufficientCreditsError,
    InternalServerError,
    MaxRoundsError,
    MaxTokensError,
    NotFoundError,
    OverloadedError,
    PermissionDeniedError,
    RateLimitError,
    RequestTooLargeError,
    ServerError,
    ServiceUnavailableError,
    UnauthorizedError,
    UnprocessableEntityError,
    UsageError,
} from './generation';
export { ThisIsABug } from './bugs';

export {
    ClientServerOutOfSyncError,
    ConnectionError,
    SDKUnsupportedError,
    WebSocketConnectionError,
    WebSocketTimeoutError,
} from './connection';

export { InvocationError, NotRunningError, TooManyInvocationsError } from './invocation';
const ERROR_MAP: Record<string, new (message: string) => Error> = {
    // Generation errors
    APIConnectionError,
    APITimeoutError,
    BadRequestError,
    ConflictError,
    ContentFilteringError,
    DeadlineExceededError,
    GenerationError,
    InferenceError,
    InternalServerError,
    UsageError,
    MaxTokensError,
    MaxRoundsError,
    NotFoundError,
    OverloadedError,
    PermissionDeniedError,
    InsufficientCreditsError,
    RateLimitError,
    RequestTooLargeError,
    ServerError,
    ServiceUnavailableError,
    UnauthorizedError,
    UnprocessableEntityError,
    // Connection errors
    ConnectionError,
    WebSocketConnectionError,
    WebSocketTimeoutError,
    SDKUnsupportedError,
    ClientServerOutOfSyncError,
    // Invocation errors
    InvocationError,
    NotRunningError,
    TooManyInvocationsError,
    ThisIsABug,
};

export const attemptToParseMultiplexError = (errorMsg: MultiplexErrorMessage): Error => {
    const error = attemptToParseError(errorMsg.error_name, errorMsg.error_message ?? 'Unknown error');

    if (error instanceof AgenticaError) {
        error.uid = errorMsg.uid ?? undefined;
        error.iid = errorMsg.iid;
        error.sessionId = errorMsg.session_id ?? undefined;
        error.sessionManagerId = errorMsg.session_manager_id ?? undefined;
        error.errorTimestamp = errorMsg.timestamp;
    }

    return error;
};

export const attemptToParseError = (name: string, message: string): Error => {
    const ErrorConstructor = ERROR_MAP[name];
    if (ErrorConstructor) return new ErrorConstructor(message);
    return new ServerError(message);
};
