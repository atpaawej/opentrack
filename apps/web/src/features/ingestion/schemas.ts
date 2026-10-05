import { Schema } from '@effect/schema';

export const CapturePayloadSchema = Schema.Struct({
  api_key: Schema.optional(Schema.String.pipe(Schema.nonEmptyString())),
  event: Schema.String.pipe(Schema.nonEmptyString()),
  distinct_id: Schema.optional(Schema.String.pipe(Schema.nonEmptyString())),
  session_id: Schema.optional(Schema.String),
  alias: Schema.optional(Schema.String.pipe(Schema.nonEmptyString())),
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

export const BatchCaptureObjectSchema = Schema.Struct({
  api_key: Schema.optional(Schema.String.pipe(Schema.nonEmptyString())),
  batch: Schema.Array(CapturePayloadSchema),
});

export const BatchCapturePayloadSchema = Schema.Union(
  Schema.Array(CapturePayloadSchema),
  BatchCaptureObjectSchema
);

export type BatchCapturePayload = Schema.Schema.Type<typeof BatchCapturePayloadSchema>;
