const DISTINCT_ID_KEY = 'ot_distinct_id';
const SESSION_ID_KEY = 'ot_session_id';
const SESSION_EXPIRES_KEY = 'ot_session_expires_at';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const DISTINCT_ID_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

export type PersistenceType = 'localStorage' | 'cookie' | 'memory';

let persistenceMode: PersistenceType = 'localStorage';
let cookieDomain: string | undefined = undefined;

let memoryDistinctId: string | null = null;
let memorySessionId: string | null = null;
let memorySessionExpiresAt = 0;

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

function getCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '=([^;]*)')
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number, domain?: string): void {
  if (typeof document === 'undefined') return;
  let cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
  if (domain) {
    cookie += `; domain=${domain}`;
  }
  document.cookie = cookie;
}

function deleteCookie(name: string, domain?: string): void {
  if (typeof document === 'undefined') return;
  let cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  if (domain) {
    cookie += `; domain=${domain}`;
  }
  document.cookie = cookie;
  // Also delete without explicit domain if set
  if (domain) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function configureSession(
  persistence: PersistenceType = 'localStorage',
  domain?: string
): void {
  persistenceMode = persistence;
  cookieDomain = domain;
}

export function getOrCreateDistinctId(): string {
  if (persistenceMode === 'memory') {
    if (!memoryDistinctId) {
      memoryDistinctId = generateUUID();
    }
    return memoryDistinctId;
  }

  if (persistenceMode === 'cookie') {
    let distinctId = getCookie(DISTINCT_ID_KEY);
    if (!distinctId) {
      distinctId = memoryDistinctId || generateUUID();
      setCookie(DISTINCT_ID_KEY, distinctId, DISTINCT_ID_MAX_AGE, cookieDomain);
    }
    memoryDistinctId = distinctId;
    return distinctId;
  }

  // Default: localStorage
  const storage = getStorage();
  if (storage) {
    let distinctId = storage.getItem(DISTINCT_ID_KEY);
    if (!distinctId) {
      distinctId = memoryDistinctId || generateUUID();
      try {
        storage.setItem(DISTINCT_ID_KEY, distinctId);
      } catch {
        // Ignore quota/private mode errors
      }
    }
    memoryDistinctId = distinctId;
    return distinctId;
  }

  if (!memoryDistinctId) {
    memoryDistinctId = generateUUID();
  }
  return memoryDistinctId;
}

export function setDistinctId(newId: string): void {
  memoryDistinctId = newId;

  if (persistenceMode === 'cookie') {
    setCookie(DISTINCT_ID_KEY, newId, DISTINCT_ID_MAX_AGE, cookieDomain);
    return;
  }

  if (persistenceMode === 'localStorage') {
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(DISTINCT_ID_KEY, newId);
      } catch {
        // Ignore quota errors
      }
    }
  }
}

export function getOrCreateSessionId(): string {
  const now = Date.now();

  if (persistenceMode === 'memory') {
    if (!memorySessionId || now > memorySessionExpiresAt) {
      memorySessionId = generateUUID();
    }
    memorySessionExpiresAt = now + SESSION_DURATION_MS;
    return memorySessionId;
  }

  if (persistenceMode === 'cookie') {
    let sessionId = getCookie(SESSION_ID_KEY);
    const expiresAt = Number(getCookie(SESSION_EXPIRES_KEY) || '0');

    if (!sessionId || now > expiresAt) {
      sessionId = generateUUID();
    }

    setCookie(SESSION_ID_KEY, sessionId, SESSION_DURATION_MS / 1000, cookieDomain);
    setCookie(SESSION_EXPIRES_KEY, String(now + SESSION_DURATION_MS), SESSION_DURATION_MS / 1000, cookieDomain);
    memorySessionId = sessionId;
    memorySessionExpiresAt = now + SESSION_DURATION_MS;
    return sessionId;
  }

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

    memorySessionId = sessionId;
    memorySessionExpiresAt = now + SESSION_DURATION_MS;
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
  deleteCookie(SESSION_ID_KEY, cookieDomain);
  deleteCookie(SESSION_EXPIRES_KEY, cookieDomain);
  memorySessionId = null;
  memorySessionExpiresAt = 0;
}

export function resetAll(): void {
  resetSession();
  const storage = getStorage();
  if (storage) {
    storage.removeItem(DISTINCT_ID_KEY);
  }
  deleteCookie(DISTINCT_ID_KEY, cookieDomain);
  memoryDistinctId = null;
}
