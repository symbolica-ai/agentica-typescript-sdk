import { AgenticaError } from './base';

/** Base class for exceptions during remote operations. */
export class ServerError extends AgenticaError {
    constructor(message: string) {
        super(message);
    }
}

// === Base Exceptions ===

/** Base class for exceptions during agent generation. */
export class GenerationError extends ServerError {
    constructor(message: string) {
        super(message);
    }
}

// === Generation Exceptions ===

/** Usage error. */
export class UsageError extends GenerationError {
    constructor(message: string) {
        super(message);
    }
}

/** Max tokens error. */
export class MaxTokensError extends UsageError {
    constructor(maxTokens: number | string) {
        const message =
            typeof maxTokens === 'number'
                ? `The maximum number of tokens (${maxTokens}) has been reached.`
                : String(maxTokens);
        super(message);
    }
}

/** Max rounds error. */
export class MaxRoundsError extends UsageError {
    constructor(maxRounds: number | string) {
        const message =
            typeof maxRounds === 'number'
                ? `The maximum number of rounds of inference (${maxRounds}) has been reached.`
                : String(maxRounds);
        super(message);
    }
}

/** Content filtering error. */
export class ContentFilteringError extends GenerationError {
    constructor() {
        super('The previously generated content has been filtered.');
    }
}

/** Base class for exceptions during inference, mainly HTTP errors. */
export class InferenceError extends GenerationError {
    constructor(message: string) {
        super(message);
    }
}

// === Inference errors ===

/** API connection error. */
export class APIConnectionError extends InferenceError {}

/** API timeout error. */
export class APITimeoutError extends InferenceError {}

// HTTP status errors

/** Rate limit error. */
export class RateLimitError extends InferenceError {}

/** Bad request error. */
export class BadRequestError extends InferenceError {}

/** Unauthorized error. */
export class UnauthorizedError extends InferenceError {}

/** Permission denied error. */
export class PermissionDeniedError extends InferenceError {}

/** Insufficient credits error. */
export class InsufficientCreditsError extends InferenceError {}

/** Not found error. */
export class NotFoundError extends InferenceError {}

/** Conflict error. */
export class ConflictError extends InferenceError {}

/** Unprocessable entity error. */
export class UnprocessableEntityError extends InferenceError {}

/** Request too large error. */
export class RequestTooLargeError extends InferenceError {}

/** Service unavailable error. */
export class ServiceUnavailableError extends InferenceError {}

/** Overloaded error. */
export class OverloadedError extends InferenceError {}

/** Deadline exceeded error. */
export class DeadlineExceededError extends InferenceError {}

/** Internal server error. */
export class InternalServerError extends InferenceError {}
