import { Schema } from '@effect/schema';

export const CapturePayloadSchema = Schema.Struct({
  api_key: Schema.String.pipe(Schema.nonEmptyString()),
  event: Schema.String.pipe(Schema.nonEmptyString()),
  distinct_id: Schema.String.pipe(Schema.nonEmptyString()),
  session_id: Schema.optional(Schema.String),
  properties: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    })
  ),
  timestamp: Schema.optional(
    Schema.Union(
      Schema.Number,
      Schema.String,
      Schema.Date
    )
  ),
});

export type CapturePayload = Schema.Schema.Type<typeof CapturePayloadSchema>;
