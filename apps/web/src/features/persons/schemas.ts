import { Schema } from '@effect/schema';

export const ListPersonsQuerySchema = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  projectSlug: Schema.optional(Schema.String),
  search: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
  offset: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
});

export const GetPersonProfileSchema = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  projectSlug: Schema.optional(Schema.String),
  distinctId: Schema.String,
});

export const UpdatePersonTraitSchema = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  projectSlug: Schema.optional(Schema.String),
  distinctId: Schema.String,
  key: Schema.String,
  value: Schema.Unknown,
});

export type ListPersonsQueryInput = Schema.Schema.Type<typeof ListPersonsQuerySchema>;
export type GetPersonProfileInput = Schema.Schema.Type<typeof GetPersonProfileSchema>;
export type UpdatePersonTraitInput = Schema.Schema.Type<typeof UpdatePersonTraitSchema>;
