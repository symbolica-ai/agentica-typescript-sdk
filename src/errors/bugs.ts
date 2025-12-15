/** Presumed unreachable code paths should raise errors which the user can use to report bugs. */

import { AgenticaError } from './base';

const GITHUB_ISSUES_URL = 'https://github.com/symbolca-ai/agentica-issues/issues';

/** Raise this error when reaching this path in the code should be considered a bug. */
export class ThisIsABug extends AgenticaError {
    constructor(message: string, reportUrl?: string, dumpPath?: string) {
        if (reportUrl === undefined) {
            reportUrl = GITHUB_ISSUES_URL;
        }
        message += `\nPlease file a bug report at ${reportUrl}`;
        if (dumpPath !== undefined) {
            message += `\nPlease include your crash dump: ${dumpPath}`;
        }
        super(message);
    }
}
