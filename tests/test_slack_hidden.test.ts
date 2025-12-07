import { agentic } from '@agentica/agentic';
import { WebClient } from '@slack/web-api';
import { describe, expect, it } from 'vitest';

// Mock Slack client (no real token needed for testing)
const slackClient = new WebClient();

describe('Slack API - is_top_level verification', () => {
    it('should correctly hide transitive Slack types', async () => {
        // NOTE: _hidden_locals is now EMPTY and deprecated.
        const postMessage = slackClient.chat.postMessage;
        const userName = 'tslil';

        /**mock
        ```python
        return list(_hidden_locals), list(locals().keys())
        ```
        */
        const result = await agentic<[string[], string[]]>('Return _hidden_locals as a list', {
            postMessage,
            userName,
        });

        const [hiddenLocals, allLocals] = result;
        console.log('Hidden locals:', hiddenLocals);
        console.log('All locals:', allLocals);

        expect(hiddenLocals).not.toContain('postMessage');
        expect(hiddenLocals).not.toContain('userName');
        expect(allLocals).toContain('postMessage');
        expect(allLocals).toContain('userName');
    });

    it('should show the correct stubs for functions', async () => {
        const postMessage = slackClient.chat.postMessage;
        const userName = 'tslil';

        /**mock
        ```python
        return _emit_stubs({"postMessage": postMessage, "userName": userName})[0]
        ```
        */
        const result = await agentic<string>('Return _emit_stubs as a string', { postMessage, userName });

        console.log('Stubs for locals:\n', result);

        // NOTE: this depends on pnpm vs npm and probably other things too.
        expect(result).toContain(`def postMessage(options: TokenOverridableAndChannelAnd`);
        expect(result).toContain(`userName: str = 'tslil'`);
    });
});
