import { agentic } from '@agentica/agentic';
import { WebClient } from '@slack/web-api';

const SLACK_BOT_TOKEN = 'xoxb-6550429457063-9528918301127-SshR0u2N7Dmb1pKriON0pV7o';

// Initialize Slack client
const slackClient = new WebClient(SLACK_BOT_TOKEN);

/** Post message
 * @param userName The name of the user to send a morning message to
 */
async function postMessage(userName: string, text: string): Promise<void> {
    await slackClient.chat.postMessage({
        channel: `@${userName}`,
        text: text,
    });
}

/**
 * Uses the Slack API to send the user a direct message. Light and cheerful!
 * @param userName The name of the user to send a morning message to
 */
async function sendMorningMessage(userName: string): Promise<void> {
    await agentic<void>('Use the Slack API to send the user a direct message. Light and cheerful!', {
        postMessage,
        userName,
    });
}

// Execute the function
void sendMorningMessage('tslil');
