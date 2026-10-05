import {
  getOrCreateDistinctId,
  setDistinctId,
  getOrCreateSessionId,
  resetAll,
  configureSession,
  type PersistenceType,
} from './session';
import { sendEvent, setupTransportListeners, type TransportPayload } from './transport';
import { getAutomaticProperties } from './properties';
import { setupAutocapture, teardownAutocapture } from './autocapture';
import { setupPageviewTracking, teardownPageviewTracking } from './pageview';

export interface OpenTrackConfig {
  apiKey: string;
  endpoint?: string;
  api_host?: string;
  debug?: boolean;
  autocapture?: boolean;
  capture_pageview?: boolean;
  persistence?: PersistenceType;
  cookie_domain?: string;
  disable_session_recording?: boolean;
}

export interface OpenTrackInstance {
  init: (apiKeyOrConfig: string | OpenTrackConfig, options?: Partial<OpenTrackConfig>) => void;
  capture: (eventName: string, properties?: Record<string, unknown>) => Promise<boolean>;
  identify: (distinctId: string, properties?: Record<string, unknown>) => Promise<boolean>;
  getDistinctId: () => string;
  getSessionId: () => string;
  reset: (options?: { clearConfig?: boolean }) => void;
}

let currentConfig: OpenTrackConfig | null = null;

export function init(
  apiKeyOrConfig: string | OpenTrackConfig,
  options?: Partial<OpenTrackConfig>
): void {
  let apiKey = '';
  let opts: Partial<OpenTrackConfig> = {};

  if (typeof apiKeyOrConfig === 'string') {
    apiKey = apiKeyOrConfig;
    opts = options || {};
  } else if (apiKeyOrConfig && typeof apiKeyOrConfig === 'object') {
    apiKey = apiKeyOrConfig.apiKey;
    opts = apiKeyOrConfig;
  }

  if (!apiKey) {
    console.error('[OpenTrack] API key is required to initialize OpenTrack');
    return;
  }

  let endpoint = opts.endpoint;
  if (!endpoint && opts.api_host) {
    endpoint = `${opts.api_host.replace(/\/$/, '')}/api/v1/capture`;
  }
  if (!endpoint) {
    endpoint = '/api/v1/capture';
  }

  currentConfig = {
    apiKey,
    endpoint,
    api_host: opts.api_host,
    debug: opts.debug ?? false,
    autocapture: opts.autocapture ?? false,
    capture_pageview: opts.capture_pageview ?? true,
    persistence: opts.persistence ?? 'localStorage',
    cookie_domain: opts.cookie_domain,
    disable_session_recording: opts.disable_session_recording,
  };

  // Configure session persistence
  configureSession(currentConfig.persistence, currentConfig.cookie_domain);

  // Setup transport listeners for online/unload handling
  setupTransportListeners();

  // Teardown previous listeners if re-initializing
  teardownAutocapture();
  teardownPageviewTracking();

  // Setup autocapture if enabled
  if (currentConfig.autocapture) {
    setupAutocapture((props) => {
      void capture('$click', props);
    });
  }

  // Setup SPA pageview tracking if enabled
  if (currentConfig.capture_pageview) {
    setupPageviewTracking(() => {
      void capture('$pageview');
    });
    // Send initial pageview event
    void capture('$pageview');
  }

  if (currentConfig.debug) {
    console.log('[OpenTrack] Initialized with config:', currentConfig);
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

  // Enrich with automatic properties
  const autoProperties = getAutomaticProperties();
  const mergedProperties = {
    ...autoProperties,
    ...properties,
  };

  const payload: TransportPayload = {
    api_key: currentConfig.apiKey,
    event: eventName,
    distinct_id: distinctId,
    session_id: sessionId,
    properties: mergedProperties,
    timestamp: Date.now(),
  };

  return sendEvent(currentConfig.endpoint || '/api/v1/capture', payload, currentConfig.debug);
}

export async function identify(
  distinctId: string,
  properties: Record<string, unknown> = {}
): Promise<boolean> {
  if (!currentConfig) {
    console.error('[OpenTrack] Client not initialized. Call init(apiKey) before identifying.');
    return false;
  }

  if (!distinctId) {
    console.error('[OpenTrack] distinctId is required for identify()');
    return false;
  }

  const anonDistinctId = getDistinctId();

  // Switch distinct ID to the canonical identified user ID
  setDistinctId(distinctId);

  return capture('$identify', {
    $anon_distinct_id: anonDistinctId,
    ...properties,
  });
}

export function getDistinctId(): string {
  return getOrCreateDistinctId();
}

export function getSessionId(): string {
  return getOrCreateSessionId();
}

export function reset(options?: { clearConfig?: boolean }): void {
  resetAll();
  if (options?.clearConfig) {
    currentConfig = null;
  }
}

const opentrack: OpenTrackInstance = {
  init,
  capture,
  identify,
  getDistinctId,
  getSessionId,
  reset,
};

// Check if running in browser and auto-initialize via script data attributes
if (typeof window !== 'undefined') {
  (window as unknown as { opentrack?: OpenTrackInstance }).opentrack = opentrack;

  if (typeof document !== 'undefined') {
    const currentScript = document.currentScript;
    if (currentScript) {
      const apiKey = currentScript.getAttribute('data-api-key');
      const endpoint = currentScript.getAttribute('data-endpoint') || undefined;
      const autocapture = currentScript.getAttribute('data-autocapture') === 'true';
      if (apiKey) {
        init(apiKey, { endpoint, autocapture });
      }
    }
  }
}

export { opentrack };
export default opentrack;
