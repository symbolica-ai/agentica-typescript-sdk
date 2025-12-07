import { agentic } from '@agentica/agentic';
import { WebClient } from '@slack/web-api';

/**
 * Test using the postMessage function from the Slack API
 */
async function _testSlackAPI() {
    const slackClient = new WebClient('fake-token-for-demo');
    const postMessage = slackClient.chat.postMessage.bind(slackClient.chat);

    // Pass the postMessage function to magic
    const result = await agentic<string>('Use postMessage to send a message to the user.', { postMessage });

    console.log('Magic result:', result);
    return result;
}
