import { Data } from 'effect';

export class InsightError extends Data.TaggedError('InsightError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
