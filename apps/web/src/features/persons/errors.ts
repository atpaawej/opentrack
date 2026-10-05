import { Data } from 'effect';

export class PersonNotFoundError extends Data.TaggedError('PersonNotFoundError')<{
  readonly distinctId: string;
  readonly message?: string;
}> {}

export class PersonsDatabaseError extends Data.TaggedError('PersonsDatabaseError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class PersonsValidationError extends Data.TaggedError('PersonsValidationError')<{
  readonly message: string;
  readonly details?: unknown;
}> {}

export type PersonsError =
  | PersonNotFoundError
  | PersonsDatabaseError
  | PersonsValidationError;
