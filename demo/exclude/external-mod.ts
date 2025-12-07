import { agentic } from '@agentica/agentic';
import { WebClient } from '@slack/web-api';

/**
 * Test external npm package imports with Slack API
 */
async function testSlackAPI() {
    const slackClient = new WebClient('fake-token-for-demo');

    // Pass external npm package instance to magic
    // This should generate: await import('@slack/web-api')
    const result = await agentic<string>({ slackClient });

    console.log('Magic result:', result);
    return result;
}

export { testSlackAPI };
