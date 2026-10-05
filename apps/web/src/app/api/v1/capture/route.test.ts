import { describe, it, expect } from 'vitest';
import { OPTIONS, POST } from './route';

describe('/api/v1/capture Route Handler', () => {
  it('handles OPTIONS preflight with CORS headers', async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('returns 400 for malformed JSON', async () => {
    const req = new Request('http://localhost:3000/api/v1/capture', {
      method: 'POST',
      body: 'invalid-json{',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON body');
  });

  it('returns 400 for missing required payload fields', async () => {
    const req = new Request('http://localhost:3000/api/v1/capture', {
      method: 'POST',
      body: JSON.stringify({ api_key: 'ot_live_test' }), // missing event and distinct_id
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid payload');
  });

  it('returns 401 for invalid API key', async () => {
    const req = new Request('http://localhost:3000/api/v1/capture', {
      method: 'POST',
      body: JSON.stringify({
        api_key: 'ot_live_unknown_key_xyz',
        event: 'test_click',
        distinct_id: 'user_123',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid API key');
  });
});
