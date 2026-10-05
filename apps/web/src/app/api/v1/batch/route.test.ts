import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OPTIONS, POST } from './route';
import { db } from '@/lib/db';
import { projects, events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('/api/v1/batch Route Handler', () => {
  const testApiKey = `ot_live_batch_test_${Date.now()}`;
  let testProjectId: string;

  beforeAll(async () => {
    const [inserted] = await db
      .insert(projects)
      .values({
        name: 'Batch Route Test Project',
        slug: `test-batch-route-${Date.now()}`,
        clerkUserId: 'test_user_batch_route',
        apiKey: testApiKey,
        allowedDomains: ['opentrack.dev', 'localhost'],
      })
      .returning();
    testProjectId = inserted.id;
  });

  afterAll(async () => {
    if (testProjectId) {
      await db.delete(events).where(eq(events.projectId, testProjectId));
      await db.delete(projects).where(eq(projects.id, testProjectId));
    }
  });

  it('handles OPTIONS preflight with CORS headers', async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-OpenTrack-Key');
  });

  it('returns 400 for malformed JSON', async () => {
    const req = new Request('http://localhost:3000/api/v1/batch', {
      method: 'POST',
      body: 'invalid-json{',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON body');
  });

  it('returns 400 for empty batch array', async () => {
    const req = new Request('http://localhost:3000/api/v1/batch', {
      method: 'POST',
      body: JSON.stringify({ api_key: testApiKey, batch: [] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid payload');
  });

  it('returns 400 when an event in batch is missing required fields', async () => {
    const req = new Request('http://localhost:3000/api/v1/batch', {
      method: 'POST',
      body: JSON.stringify({
        api_key: testApiKey,
        batch: [
          { distinct_id: 'user_1' }, // missing event name
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid payload');
  });

  it('returns 401 for unknown or invalid API key', async () => {
    const req = new Request('http://localhost:3000/api/v1/batch', {
      method: 'POST',
      body: JSON.stringify({
        api_key: 'ot_live_unknown_batch_key_xyz',
        batch: [
          { event: 'button_clicked', distinct_id: 'user_1' },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid API key');
  });

  it('returns 403 when origin does not match allowedDomains', async () => {
    const req = new Request('http://localhost:3000/api/v1/batch', {
      method: 'POST',
      body: JSON.stringify({
        api_key: testApiKey,
        batch: [
          { event: 'test_origin_blocked', distinct_id: 'user_origin' },
        ],
      }),
      headers: {
        'Content-Type': 'application/json',
        origin: 'https://disallowed-domain.org',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Domain not allowed');
  });

  it('returns 200 and processes batch with API key in body', async () => {
    const req = new Request('http://localhost:3000/api/v1/batch', {
      method: 'POST',
      body: JSON.stringify({
        api_key: testApiKey,
        batch: [
          { event: 'pageview', distinct_id: 'visitor_1' },
          { event: 'signup_click', distinct_id: 'visitor_1' },
        ],
      }),
      headers: {
        'Content-Type': 'application/json',
        origin: 'https://opentrack.dev',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.processed).toBe(2);
  });

  it('returns 200 with API key provided in X-OpenTrack-Key header and array body', async () => {
    const req = new Request('http://localhost:3000/api/v1/batch', {
      method: 'POST',
      body: JSON.stringify([
        { event: 'sdk_flush_1', distinct_id: 'visitor_sdk' },
        { event: 'sdk_flush_2', distinct_id: 'visitor_sdk' },
      ]),
      headers: {
        'Content-Type': 'application/json',
        'X-OpenTrack-Key': testApiKey,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.processed).toBe(2);
  });
});
