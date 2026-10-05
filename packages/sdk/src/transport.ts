export interface TransportPayload {
  api_key: string;
  event: string;
  distinct_id: string;
  session_id?: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}

export interface QueueItem {
  endpoint: string;
  payload: TransportPayload;
  debug?: boolean;
}

const eventQueue: QueueItem[] = [];
let isFlushing = false;
let listenersAttached = false;
let currentWindow: unknown = null;
let onlineListener: (() => void) | null = null;
let visibilityListener: (() => void) | null = null;
let pagehideListener: (() => void) | null = null;

export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

export function setupTransportListeners(): void {
  if (typeof window === 'undefined') return;
  if (listenersAttached && currentWindow === window) return;

  teardownTransportListeners();
  listenersAttached = true;
  currentWindow = window;

  onlineListener = () => {
    void flushQueue();
  };
  window.addEventListener('online', onlineListener);

  const handleUnload = () => {
    flushQueueWithBeacon();
  };

  if (typeof document !== 'undefined') {
    visibilityListener = () => {
      if (document.visibilityState === 'hidden') {
        handleUnload();
      }
    };
    document.addEventListener('visibilitychange', visibilityListener);
  }

  pagehideListener = handleUnload;
  window.addEventListener('pagehide', pagehideListener);
}

export function teardownTransportListeners(): void {
  if (currentWindow && typeof currentWindow === 'object' && 'removeEventListener' in currentWindow) {
    const win = currentWindow as { removeEventListener: (type: string, cb: unknown) => void };
    if (onlineListener) {
      win.removeEventListener('online', onlineListener);
      onlineListener = null;
    }
    if (pagehideListener) {
      win.removeEventListener('pagehide', pagehideListener);
      pagehideListener = null;
    }
  }
  if (typeof document !== 'undefined' && visibilityListener) {
    document.removeEventListener('visibilitychange', visibilityListener);
    visibilityListener = null;
  }
  listenersAttached = false;
  currentWindow = null;
}

export function flushQueueWithBeacon(): void {
  if (eventQueue.length === 0) return;

  const items = eventQueue.splice(0, eventQueue.length);
  for (const item of items) {
    let sent = false;
    const jsonPayload = JSON.stringify(item.payload);

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([jsonPayload], { type: 'application/json' });
        sent = navigator.sendBeacon(item.endpoint, blob);
      } catch {
        sent = false;
      }
    }

    if (!sent && typeof fetch !== 'undefined') {
      try {
        fetch(item.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: jsonPayload,
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Ignore during unload
      }
    }
  }
}

export async function flushQueue(): Promise<void> {
  if (isFlushing || eventQueue.length === 0 || !isOnline()) {
    return;
  }

  isFlushing = true;
  try {
    while (eventQueue.length > 0 && isOnline()) {
      const item = eventQueue[0];
      try {
        const response = await fetch(item.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item.payload),
          keepalive: true,
        });

        if (response.ok) {
          eventQueue.shift();
        } else {
          // Server returned error status, break to retry later
          break;
        }
      } catch {
        // Network error, break loop
        break;
      }
    }
  } finally {
    isFlushing = false;
  }
}

export function getEventQueue(): QueueItem[] {
  return [...eventQueue];
}

export function clearEventQueue(): void {
  eventQueue.length = 0;
}

export async function sendEvent(
  endpoint: string,
  payload: TransportPayload,
  debug = false
): Promise<boolean> {
  setupTransportListeners();

  const jsonPayload = JSON.stringify(payload);

  if (debug) {
    console.log('[OpenTrack] Dispatching event:', payload);
  }

  // If offline, queue event immediately
  if (!isOnline()) {
    if (debug) {
      console.log('[OpenTrack] Client offline, queuing event:', payload.event);
    }
    eventQueue.push({ endpoint, payload, debug });
    return false;
  }

  // Try fetch with keepalive: true
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

      if (response.ok) {
        if (debug) {
          console.log('[OpenTrack] Event sent via fetch, status:', response.status);
        }
        // Next event succeeds -> flush queue
        void flushQueue();
        return true;
      } else {
        if (debug) {
          console.warn('[OpenTrack] Fetch response error, queuing event:', response.status);
        }
        eventQueue.push({ endpoint, payload, debug });
        return false;
      }
    } catch (err) {
      if (debug) {
        console.warn('[OpenTrack] Fetch failed, queuing event:', err);
      }
      eventQueue.push({ endpoint, payload, debug });
      return false;
    }
  }

  // Fallback to sendBeacon if fetch is not available
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([jsonPayload], { type: 'application/json' });
      const queued = navigator.sendBeacon(endpoint, blob);
      if (queued) {
        if (debug) console.log('[OpenTrack] Event sent via sendBeacon');
        return true;
      }
    } catch (e) {
      if (debug) console.warn('[OpenTrack] sendBeacon failed:', e);
    }
  }

  eventQueue.push({ endpoint, payload, debug });
  return false;
}
