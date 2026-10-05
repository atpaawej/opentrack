import { Data } from 'effect';

export class ProjectValidationError extends Data.TaggedError('ProjectValidationError')<{
  readonly message: string;
  readonly details?: unknown;
}> {}

export class ProjectNotFoundError extends Data.TaggedError('ProjectNotFoundError')<{
  readonly slug: string;
  readonly message: string;
}> {}

export class UnauthorizedProjectAccessError extends Data.TaggedError('UnauthorizedProjectAccessError')<{
  readonly slug: string;
  readonly message: string;
}> {}

export class ProjectDatabaseError extends Data.TaggedError('ProjectDatabaseError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type ProjectError =
  | ProjectValidationError
  | ProjectNotFoundError
  | UnauthorizedProjectAccessError
  | ProjectDatabaseError;
