import { Effect, Exit, Cause } from 'effect';
import { ingestEvent } from '@/features/ingestion/service';
import {
  PayloadValidationError,
  InvalidApiKeyError,
  DatabaseWriteError,
} from '@/features/ingestion/errors';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Extract client IP from reverse proxy headers
  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    undefined;

  // Execute Effect workflow
  const exit = await Effect.runPromiseExit(ingestEvent(body, clientIp));

  if (Exit.isSuccess(exit)) {
    return Response.json(
      { status: 'ok', eventId: exit.value.id },
      { status: 200, headers: corsHeaders }
    );
  }

  // Failure: inspect tagged domain error
  const failure = Cause.failureOption(exit.cause);

  if (failure._tag === 'Some') {
    const error = failure.value;

    if (error._tag === 'PayloadValidationError') {
      return Response.json(
        {
          error: 'Invalid payload',
          details: error.details || error.message,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (error._tag === 'InvalidApiKeyError') {
      return Response.json(
        {
          error: 'Invalid API key',
          message: error.message,
        },
        { status: 401, headers: corsHeaders }
      );
    }

    if (error._tag === 'DatabaseWriteError') {
      console.error('[capture] Database write error:', error.message, error.cause);
      return Response.json(
        { error: 'Failed to persist event' },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  console.error('[capture] Unexpected pipeline defect:', Cause.pretty(exit.cause));
  return Response.json(
    { error: 'Internal Server Error' },
    { status: 500, headers: corsHeaders }
  );
}
