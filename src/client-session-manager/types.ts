// Re-export the generated types for convenience
export type { components, operations, paths } from '../types/api.d';

// Import components to use in type aliases
import type { components } from '../types/api.d';

// Additional convenience types based on the OpenAPI schema
// Override CreateAgentRequest to use Uint8Array for warp_globals_payload and remove json field
export type CreateAgentRequest = Omit<
    components['schemas']['CreateAgentRequest'],
    'warp_globals_payload' | 'protocol' | 'json'
> & {
    warp_globals_payload: Uint8Array;
    protocol?: string;
};

export type PromptTemplate = components['schemas']['PromptTemplate'];

// Multiplex message types with binary field overrides
export type MultiplexCancelMessage = components['schemas']['MultiplexCancelMessage'];
export type MultiplexDataMessage = Omit<components['schemas']['MultiplexDataMessage'], 'data'> & {
    data: Uint8Array;
};
export type MultiplexErrorMessage = components['schemas']['MultiplexErrorMessage'];
export type MultiplexInvocationMessage = components['schemas']['MultiplexInvocationEventMessage']; // Note: using InvocationEventMessage
export type MultiplexInvokeMessage = Omit<components['schemas']['MultiplexInvokeMessage'], 'warp_locals_payload'> & {
    warp_locals_payload: Uint8Array;
};
export type MultiplexNewIIDResponse = components['schemas']['MultiplexNewIIDResponse'];

// Custom union types with corrected binary fields
export type MultiplexMessage =
    | MultiplexDataMessage
    | MultiplexErrorMessage
    | MultiplexInvocationMessage
    | MultiplexNewIIDResponse
    | MultiplexCancelMessage
    | MultiplexInvokeMessage;

export type MultiplexClientMessage = MultiplexInvokeMessage | MultiplexDataMessage | MultiplexCancelMessage;

export type MultiplexClientInstanceMessage = MultiplexDataMessage | MultiplexCancelMessage;

export type MultiplexServerMessage =
    | MultiplexNewIIDResponse
    | MultiplexErrorMessage
    | MultiplexDataMessage
    | MultiplexInvocationMessage;

export type MultiplexServerInstanceMessage = MultiplexErrorMessage | MultiplexDataMessage | MultiplexInvocationMessage;
