import { describe, it, expect, beforeEach, vi } from 'vitest';
import { init, capture, getDistinctId, getSessionId, reset } from './index';

describe('OpenTrack Client SDK', () => {
  beforeEach(() => {
    reset();
    vi.restoreAllMocks();
  });

  it('generates distinct_id and session_id', () => {
    const distinctId = getDistinctId();
    const sessionId = getSessionId();

    expect(distinctId).toBeDefined();
    expect(typeof distinctId).toBe('string');
    expect(distinctId.length).toBeGreaterThan(10);

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(10);
  });

  it('returns false and logs error if capture is called before init', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await capture('test_event');
    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('dispatches event via fetch when initialized', async () => {
    init('ot_live_test_key', { endpoint: 'http://localhost:3000/api/v1/capture' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const success = await capture('page_view', { page: '/pricing' });
    expect(success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/capture');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.api_key).toBe('ot_live_test_key');
    expect(body.event).toBe('page_view');
    expect(body.properties).toEqual({ page: '/pricing' });
    expect(body.distinct_id).toBeDefined();
    expect(body.session_id).toBeDefined();
  });
});
