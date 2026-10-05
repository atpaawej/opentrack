import { Data } from 'effect';

export class FunnelError extends Data.TaggedError('FunnelError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
