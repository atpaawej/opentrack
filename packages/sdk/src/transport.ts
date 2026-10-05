export interface TransportPayload {
  api_key: string;
  event: string;
  distinct_id: string;
  session_id?: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}

export async function sendEvent(
  endpoint: string,
  payload: TransportPayload,
  debug = false
): Promise<boolean> {
  const jsonPayload = JSON.stringify(payload);

  if (debug) {
    console.log('[OpenTrack] Dispatching event:', payload);
  }

  // 1. Try navigator.sendBeacon if available (ideal for page unloads / background dispatch)
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([jsonPayload], { type: 'application/json' });
      const queued = navigator.sendBeacon(endpoint, blob);
      if (queued) {
        if (debug) console.log('[OpenTrack] Event sent via sendBeacon');
        return true;
      }
    } catch (e) {
      if (debug) console.warn('[OpenTrack] sendBeacon failed, falling back to fetch:', e);
    }
  }

  // 2. Fallback to fetch with keepalive: true
  if (typeof fetch !== 'undefined') {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonPayload,
        keepalive: true,
      });

      if (debug) {
        console.log('[OpenTrack] Event sent via fetch, status:', response.status);
      }
      return response.ok;
    } catch (err) {
      if (debug) console.error('[OpenTrack] fetch transport error:', err);
      return false;
    }
  }

  if (debug) {
    console.error('[OpenTrack] No available transport mechanism (navigator.sendBeacon or fetch)');
  }
  return false;
}
