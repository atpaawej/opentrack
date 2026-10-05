import { getOrCreateDistinctId, getOrCreateSessionId, resetSession } from './session';
import { sendEvent, type TransportPayload } from './transport';

export interface OpenTrackConfig {
  apiKey: string;
  endpoint?: string;
  debug?: boolean;
}

export interface OpenTrackInstance {
  init: (apiKey: string, options?: Partial<OpenTrackConfig>) => void;
  capture: (eventName: string, properties?: Record<string, unknown>) => Promise<boolean>;
  getDistinctId: () => string;
  getSessionId: () => string;
  reset: () => void;
}

let currentConfig: OpenTrackConfig | null = null;

export function init(apiKey: string, options?: Partial<OpenTrackConfig>): void {
  if (!apiKey) {
    console.error('[OpenTrack] API key is required to initialize OpenTrack');
    return;
  }

  currentConfig = {
    apiKey,
    endpoint: options?.endpoint || '/api/v1/capture',
    debug: options?.debug || false,
  };

  if (currentConfig.debug) {
    console.log('[OpenTrack] Initialized with config:', {
      endpoint: currentConfig.endpoint,
      debug: currentConfig.debug,
    });
  }
}

export async function capture(
  eventName: string,
  properties: Record<string, unknown> = {}
): Promise<boolean> {
  if (!currentConfig) {
    console.error('[OpenTrack] Client not initialized. Call init(apiKey) before capturing events.');
    return false;
  }

  if (!eventName) {
    console.error('[OpenTrack] Event name is required');
    return false;
  }

  const distinctId = getOrCreateDistinctId();
  const sessionId = getOrCreateSessionId();

  const payload: TransportPayload = {
    api_key: currentConfig.apiKey,
    event: eventName,
    distinct_id: distinctId,
    session_id: sessionId,
    properties,
    timestamp: Date.now(),
  };

  return sendEvent(currentConfig.endpoint || '/api/v1/capture', payload, currentConfig.debug);
}

export function getDistinctId(): string {
  return getOrCreateDistinctId();
}

export function getSessionId(): string {
  return getOrCreateSessionId();
}

export function reset(): void {
  resetSession();
}

const opentrack: OpenTrackInstance = {
  init,
  capture,
  getDistinctId,
  getSessionId,
  reset,
};

// Check if running in browser and auto-initialize via script data attributes
if (typeof window !== 'undefined') {
  (window as unknown as { opentrack?: OpenTrackInstance }).opentrack = opentrack;

  const currentScript = document.currentScript;
  if (currentScript) {
    const apiKey = currentScript.getAttribute('data-api-key');
    const endpoint = currentScript.getAttribute('data-endpoint') || undefined;
    if (apiKey) {
      init(apiKey, { endpoint });
    }
  }
}

export default opentrack;
