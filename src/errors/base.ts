export class AgenticaError extends Error {
    uid?: string;
    iid?: string;
    sessionId?: string;
    sessionManagerId?: string;
    errorTimestamp?: string;

    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }

    toString(): string {
        let msg = super.toString();

        const contextParts: string[] = [];
        if (this.uid) contextParts.push(`UID: ${this.uid}`);
        if (this.iid) contextParts.push(`IID: ${this.iid}`);
        if (this.sessionManagerId) contextParts.push(`Session Manager ID: ${this.sessionManagerId}`);
        if (this.sessionId) contextParts.push(`Session: ${this.sessionId}`);
        if (this.errorTimestamp) contextParts.push(`Time: ${this.errorTimestamp}`);

        if (contextParts.length > 0) {
            msg += `\n\nContext: ${contextParts.join(', ')}`;
            msg += '\n\nIf you need assistance, please contact support@symbolica.ai with the error details above.';
        }

        return msg;
    }
}

/**
 * Enrich an error with context information for support escalation.
 * If the error is an AgenticaError, sets context fields.
 */
export function enrichError(
    error: Error,
    context: {
        uid?: string;
        iid?: string;
        sessionId?: string;
        sessionManagerId?: string;
    }
): Error {
    if (error instanceof AgenticaError) {
        if (context.uid !== undefined) error.uid = context.uid;
        if (context.iid !== undefined) error.iid = context.iid;
        if (context.sessionId !== undefined) error.sessionId = context.sessionId;
        if (context.sessionManagerId !== undefined) error.sessionManagerId = context.sessionManagerId;
        error.errorTimestamp = new Date().toISOString();
    }
    return error;
}
