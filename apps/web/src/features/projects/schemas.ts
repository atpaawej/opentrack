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
