import { Data } from 'effect';

export class LiveStreamValidationError extends Data.TaggedError('LiveStreamValidationError')<{
  readonly message: string;
  readonly details?: unknown;
}> {}

export class LiveStreamDatabaseError extends Data.TaggedError('LiveStreamDatabaseError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type LiveStreamError = LiveStreamValidationError | LiveStreamDatabaseError;
