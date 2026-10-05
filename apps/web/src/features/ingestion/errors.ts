import { Data } from 'effect';

export class PayloadValidationError extends Data.TaggedError('PayloadValidationError')<{
  readonly message: string;
  readonly details?: unknown;
}> {}

export class InvalidApiKeyError extends Data.TaggedError('InvalidApiKeyError')<{
  readonly apiKey: string;
  readonly message: string;
}> {}

export class DomainNotAllowedError extends Data.TaggedError('DomainNotAllowedError')<{
  readonly origin: string;
  readonly allowedDomains: string[];
  readonly message: string;
}> {}

export class DatabaseWriteError extends Data.TaggedError('DatabaseWriteError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type IngestionError =
  | PayloadValidationError
  | InvalidApiKeyError
  | DomainNotAllowedError
  | DatabaseWriteError;
