/**
 * Convert HTTP URL to WebSocket URL.
 */
export function httpToWs(url: string): string {
    return url.replace('http://', 'ws://').replace('https://', 'wss://');
}
