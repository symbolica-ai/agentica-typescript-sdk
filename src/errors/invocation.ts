import { AgenticaError } from './base';

export class InvocationError extends AgenticaError {}

export class TooManyInvocationsError extends InvocationError {}

export class NotRunningError extends InvocationError {}
