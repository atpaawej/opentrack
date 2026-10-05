const DISTINCT_ID_KEY = 'ot_distinct_id';
const SESSION_ID_KEY = 'ot_session_id';
const SESSION_EXPIRES_KEY = 'ot_session_expires_at';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const testKey = '__ot_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch {
    // Storage restricted or unavailable
  }
  return null;
}

let memoryDistinctId: string | null = null;
let memorySessionId: string | null = null;
let memorySessionExpiresAt = 0;

export function getOrCreateDistinctId(): string {
  const storage = getStorage();
  if (storage) {
    let distinctId = storage.getItem(DISTINCT_ID_KEY);
    if (!distinctId) {
      distinctId = generateUUID();
      try {
        storage.setItem(DISTINCT_ID_KEY, distinctId);
      } catch {
        // Ignore quota/private mode errors
      }
    }
    return distinctId;
  }

  if (!memoryDistinctId) {
    memoryDistinctId = generateUUID();
  }
  return memoryDistinctId;
}

export function getOrCreateSessionId(): string {
  const now = Date.now();
  const storage = getStorage();

  if (storage) {
    let sessionId = storage.getItem(SESSION_ID_KEY);
    const expiresAt = Number(storage.getItem(SESSION_EXPIRES_KEY) || '0');

    if (!sessionId || now > expiresAt) {
      sessionId = generateUUID();
    }

    try {
      storage.setItem(SESSION_ID_KEY, sessionId);
      storage.setItem(SESSION_EXPIRES_KEY, String(now + SESSION_DURATION_MS));
    } catch {
      // Ignore storage errors
    }

    return sessionId;
  }

  if (!memorySessionId || now > memorySessionExpiresAt) {
    memorySessionId = generateUUID();
  }
  memorySessionExpiresAt = now + SESSION_DURATION_MS;
  return memorySessionId;
}

export function resetSession(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(SESSION_ID_KEY);
    storage.removeItem(SESSION_EXPIRES_KEY);
  }
  memorySessionId = null;
  memorySessionExpiresAt = 0;
}
