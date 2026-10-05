import { Schema } from '@effect/schema';

export const LiveStreamQuerySchema = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  projectSlug: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
  eventName: Schema.optional(Schema.Union(Schema.String, Schema.Array(Schema.String))),
  distinctId: Schema.optional(Schema.String),
  since: Schema.optional(Schema.Union(Schema.Number, Schema.String, Schema.Date)),
});

export type LiveStreamQueryInput = Schema.Schema.Type<typeof LiveStreamQuerySchema>;
