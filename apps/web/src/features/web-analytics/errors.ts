import { Data } from 'effect';

export class WebAnalyticsError extends Data.TaggedError('WebAnalyticsError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
