import { Schema } from '@effect/schema';

export const CreateProjectSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.nonEmptyString()),
  slug: Schema.optional(Schema.String),
  allowedDomains: Schema.optional(Schema.Array(Schema.String)),
});

export type CreateProjectInput = Schema.Schema.Type<typeof CreateProjectSchema>;

export const UpdateProjectDomainsSchema = Schema.Struct({
  allowedDomains: Schema.Array(Schema.String),
});

export type UpdateProjectDomainsInput = Schema.Schema.Type<typeof UpdateProjectDomainsSchema>;

export const UpdateProjectPrivacySchema = Schema.Struct({
  dataRetentionDays: Schema.optional(Schema.Number),
  timezone: Schema.optional(Schema.String),
});

export type UpdateProjectPrivacyInput = Schema.Schema.Type<typeof UpdateProjectPrivacySchema>;

export const RotateApiKeySchema = Schema.Struct({
  type: Schema.Literal('public', 'secret'),
});

export type RotateApiKeyInput = Schema.Schema.Type<typeof RotateApiKeySchema>;

export const PurgePersonDataSchema = Schema.Struct({
  distinctId: Schema.String.pipe(Schema.nonEmptyString()),
});

export type PurgePersonDataInput = Schema.Schema.Type<typeof PurgePersonDataSchema>;

export const ExportProjectEventsSchema = Schema.Struct({
  distinctId: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
});

export type ExportProjectEventsInput = Schema.Schema.Type<typeof ExportProjectEventsSchema>;

