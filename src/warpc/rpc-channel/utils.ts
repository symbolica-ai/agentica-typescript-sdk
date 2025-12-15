import { Msg } from '@warpc/msg-protocol/kinds';

export function msgToBytes(msg: Msg): Uint8Array {
    const data = JSON.stringify(msg);
    return strToBytes(data);
}

export function strToBytes(data: string): Uint8Array {
    return new TextEncoder().encode(data);
}

export function bytesToMsg(bytes: Uint8Array): Msg {
    const decoded = bytesToStr(bytes);
    return JSON.parse(decoded); // rehydration handled later
}

export function bytesToStr(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}
