import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import opentrack, {
  init,
  capture,
  identify,
  getDistinctId,
  getSessionId,
  reset,
} from './index';
import { clearEventQueue, getEventQueue, teardownTransportListeners } from './transport';
import { teardownAutocapture } from './autocapture';
import { teardownPageviewTracking } from './pageview';

class MockElement {
  tagName: string;
  id: string;
  className: string;
  textContent: string;
  value?: string;
  attributes: Record<string, string> = {};
  parentElement: MockElement | null = null;

  constructor(tagName: string, props: Partial<MockElement> = {}) {
    this.tagName = tagName.toUpperCase();
    this.id = props.id || '';
    this.className = props.className || '';
    this.textContent = props.textContent || '';
    this.value = props.value;
    if (props.attributes) {
      this.attributes = { ...props.attributes };
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  closest(selector: string): MockElement | null {
    const selectors = selector.split(',').map((s) => s.trim().toLowerCase());
    let current: MockElement | null = this;
    while (current) {
      const tag = current.tagName.toLowerCase();
      for (const sel of selectors) {
        if (sel === 'button' && tag === 'button') return current;
        if (sel === 'a' && tag === 'a') return current;
        if (sel === 'input[type="submit"]' && tag === 'input' && current.getAttribute('type') === 'submit') {
          return current;
        }
      }
      current = current.parentElement;
    }
    return null;
  }
}

describe('OpenTrack Client SDK', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let windowListeners: Record<string, Function[]> = {};
  let documentListeners: Record<string, Function[]> = {};
  let mockStorage: Record<string, string> = {};
  let mockCookies: string = '';

  beforeEach(() => {
    windowListeners = {};
    documentListeners = {};
    mockStorage = {};
    mockCookies = '';
    clearEventQueue();
    reset({ clearConfig: true });
    teardownAutocapture();
    teardownPageviewTracking();
    teardownTransportListeners();
    vi.restoreAllMocks();

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Mock localStorage
    const localStorageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
    vi.stubGlobal('localStorage', localStorageMock);

    // Mock URL and Location
    let currentUrl = 'https://analytics.example.com/dashboard?utm_source=newsletter&utm_medium=email&utm_campaign=summer';
    const locationMock = {
      get href() {
        return currentUrl;
      },
      set href(val: string) {
        currentUrl = val;
      },
      get pathname() {
        return new URL(currentUrl).pathname;
      },
      get search() {
        return new URL(currentUrl).search;
      },
    };

    // Mock History
    const historyMock = {
      pushState: vi.fn((_state: unknown, _title: string, url?: string | URL | null) => {
        if (url) {
          currentUrl = new URL(url.toString(), currentUrl).href;
        }
      }),
      replaceState: vi.fn((_state: unknown, _title: string, url?: string | URL | null) => {
        if (url) {
          currentUrl = new URL(url.toString(), currentUrl).href;
        }
      }),
    };

    // Mock Navigator
    const navigatorMock = {
      onLine: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      sendBeacon: vi.fn().mockReturnValue(true),
    };

    // Mock Document
    const documentMock = {
      referrer: 'https://referrer.example.com',
      visibilityState: 'visible',
      get cookie() {
        return mockCookies;
      },
      set cookie(val: string) {
        const parts = val.split(';');
        const [k, v] = parts[0].split('=');
        if (parts.some((p) => p.trim().startsWith('max-age=0'))) {
          // Delete cookie
          const cookies = mockCookies.split('; ').filter((c) => !c.startsWith(`${k}=`));
          mockCookies = cookies.join('; ');
        } else {
          const cookies = mockCookies.split('; ').filter((c) => c && !c.startsWith(`${k}=`));
          cookies.push(`${k}=${v}`);
          mockCookies = cookies.join('; ');
        }
      },
      addEventListener: vi.fn((event: string, cb: Function) => {
        if (!documentListeners[event]) documentListeners[event] = [];
        documentListeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: Function) => {
        if (documentListeners[event]) {
          documentListeners[event] = documentListeners[event].filter((fn) => fn !== cb);
        }
      }),
      dispatchEvent: (event: { type: string }) => {
        const cbs = documentListeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
      },
    };

    // Mock Window
    const windowMock = {
      location: locationMock,
      history: historyMock,
      navigator: navigatorMock,
      document: documentMock,
      screen: {
        width: 1920,
        height: 1080,
      },
      localStorage: localStorageMock,
      addEventListener: vi.fn((event: string, cb: Function) => {
        if (!windowListeners[event]) windowListeners[event] = [];
        windowListeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: Function) => {
        if (windowListeners[event]) {
          windowListeners[event] = windowListeners[event].filter((fn) => fn !== cb);
        }
      }),
      dispatchEvent: (event: { type: string }) => {
        const cbs = windowListeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
      },
    };

    vi.stubGlobal('window', windowMock);
    vi.stubGlobal('document', documentMock);
    vi.stubGlobal('navigator', navigatorMock);
    vi.stubGlobal('history', historyMock);
    vi.stubGlobal('location', locationMock);
  });

  afterEach(() => {
    teardownAutocapture();
    teardownPageviewTracking();
    teardownTransportListeners();
    vi.unstubAllGlobals();
  });

  describe('Initialization and Session', () => {
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
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client not initialized')
      );
    });

    it('logs error if init is called without apiKey', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      init('');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key is required')
      );
    });

    it('supports options object as first argument to init', async () => {
      init({
        apiKey: 'ot_live_test_object',
        endpoint: '/custom/capture',
        capture_pageview: false,
      });

      await capture('action');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('/custom/capture');
      const body = JSON.parse(opts.body);
      expect(body.api_key).toBe('ot_live_test_object');
    });

    it('uses api_host option to derive endpoint if endpoint is not given', async () => {
      init('ot_live_host_test', {
        api_host: 'https://ot.example.com',
        capture_pageview: false,
      });

      await capture('action');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://ot.example.com/api/v1/capture');
    });
  });

  describe('Event Capture and Property Enrichment', () => {
    it('dispatches event via fetch and enriches with automatic properties and UTMs', async () => {
      init('ot_live_test_key', {
        endpoint: 'http://localhost:3000/api/v1/capture',
        capture_pageview: false,
      });

      const success = await capture('button_clicked', { button_name: 'signup' });
      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/v1/capture');
      expect(options.method).toBe('POST');
      expect(options.keepalive).toBe(true);

      const body = JSON.parse(options.body);
      expect(body.api_key).toBe('ot_live_test_key');
      expect(body.event).toBe('button_clicked');
      expect(body.distinct_id).toBeDefined();
      expect(body.session_id).toBeDefined();

      // Enriched automatic properties
      expect(body.properties.button_name).toBe('signup');
      expect(body.properties.$current_url).toBe(
        'https://analytics.example.com/dashboard?utm_source=newsletter&utm_medium=email&utm_campaign=summer'
      );
      expect(body.properties.$pathname).toBe('/dashboard');
      expect(body.properties.$referrer).toBe('https://referrer.example.com');
      expect(body.properties.$browser).toBe('Chrome');
      expect(body.properties.$os).toBe('Windows');
      expect(body.properties.$screen_width).toBe(1920);
      expect(body.properties.$screen_height).toBe(1080);
      expect(body.properties.$utm_source).toBe('newsletter');
      expect(body.properties.$utm_medium).toBe('email');
      expect(body.properties.$utm_campaign).toBe('summer');
    });

    it('allows caller to override automatic properties', async () => {
      init('ot_live_test_key', { capture_pageview: false });

      await capture('custom_pageview', {
        $pathname: '/custom/override',
        $browser: 'CustomBrowser',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.properties.$pathname).toBe('/custom/override');
      expect(body.properties.$browser).toBe('CustomBrowser');
    });
  });

  describe('Identify and Identity Resolution', () => {
    it('captures $identify event with $anon_distinct_id and updates distinct_id', async () => {
      init('ot_live_test_key', { capture_pageview: false });

      const initialAnonId = getDistinctId();

      const success = await identify('usr_corp_999', {
        email: 'user@corp.com',
        role: 'Admin',
      });

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.event).toBe('$identify');
      // Payload distinct_id is switched to the new canonical ID
      expect(body.distinct_id).toBe('usr_corp_999');
      // Properties include previous anonymous distinct ID
      expect(body.properties.$anon_distinct_id).toBe(initialAnonId);
      expect(body.properties.email).toBe('user@corp.com');
      expect(body.properties.role).toBe('Admin');

      // Subsequent distinctId calls and captures use the new ID
      expect(getDistinctId()).toBe('usr_corp_999');

      await capture('dashboard_viewed');
      const nextBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(nextBody.distinct_id).toBe('usr_corp_999');
    });

    it('returns false and logs error if identify is called without init', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await identify('usr_123');
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client not initialized')
      );
    });

    it('returns false and logs error if identify is called with empty distinctId', async () => {
      init('ot_live_test_key', { capture_pageview: false });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await identify('');
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('distinctId is required')
      );
    });
  });

  describe('Reset and Persistence', () => {
    it('clears distinct_id and session_id upon reset()', () => {
      init('ot_live_test_key', { persistence: 'localStorage', capture_pageview: false });

      const firstDistinctId = getDistinctId();
      const firstSessionId = getSessionId();

      expect(firstDistinctId).toBeTruthy();
      expect(firstSessionId).toBeTruthy();

      reset();

      const secondDistinctId = getDistinctId();
      const secondSessionId = getSessionId();

      expect(secondDistinctId).toBeTruthy();
      expect(secondSessionId).toBeTruthy();
      expect(secondDistinctId).not.toBe(firstDistinctId);
      expect(secondSessionId).not.toBe(firstSessionId);
    });

    it('supports cookie persistence mode', () => {
      init('ot_live_test_key', {
        persistence: 'cookie',
        cookie_domain: '.example.com',
        capture_pageview: false,
      });

      const distinctId = getDistinctId();
      expect(distinctId).toBeTruthy();
      expect(mockCookies).toContain('ot_distinct_id=');

      reset();
      expect(mockCookies).not.toContain(distinctId);
    });

    it('supports memory persistence mode', () => {
      init('ot_live_test_key', {
        persistence: 'memory',
        capture_pageview: false,
      });

      const distinctId = getDistinctId();
      expect(distinctId).toBeTruthy();
      // Should not write to localStorage or cookies
      expect(Object.keys(mockStorage).length).toBe(0);
      expect(mockCookies).toBe('');

      reset();
      const newDistinctId = getDistinctId();
      expect(newDistinctId).not.toBe(distinctId);
    });
  });

  describe('Autocapture', () => {
    it('captures $click events on buttons, links, and submit inputs when enabled', async () => {
      init('ot_live_test_key', {
        autocapture: true,
        capture_pageview: false,
      });

      expect(documentListeners['click']).toBeDefined();
      expect(documentListeners['click'].length).toBeGreaterThan(0);
      const clickHandler = documentListeners['click'][0];

      // 1. Click on a <button>
      const btn = new MockElement('button', {
        id: 'checkout-btn',
        className: 'btn btn-primary',
        textContent: 'Pay Now',
      });
      clickHandler({ target: btn });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      let body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.event).toBe('$click');
      expect(body.properties.$el_tag_name).toBe('button');
      expect(body.properties.$el_id).toBe('checkout-btn');
      expect(body.properties.$el_text).toBe('Pay Now');
      expect(body.properties.$el_classes).toBe('btn btn-primary');

      // 2. Click on a child <span> inside an <a> tag
      const link = new MockElement('a', {
        id: 'pricing-link',
        className: 'nav-link',
        attributes: { href: '/pricing' },
      });
      const span = new MockElement('span', { textContent: 'View Pricing' });
      span.parentElement = link;
      clickHandler({ target: span });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.event).toBe('$click');
      expect(body.properties.$el_tag_name).toBe('a');
      expect(body.properties.$el_id).toBe('pricing-link');
      expect(body.properties.$el_href).toBe('/pricing');
      expect(body.properties.$el_text).toBe('View Pricing');

      // 3. Click on <input type="submit">
      const submitInput = new MockElement('input', {
        id: 'login-submit',
        value: 'Sign In',
        attributes: { type: 'submit' },
      });
      clickHandler({ target: submitInput });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      body = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(body.event).toBe('$click');
      expect(body.properties.$el_tag_name).toBe('input');
      expect(body.properties.$el_text).toBe('Sign In');

      // 4. Click on a non-interactive element (e.g. <div>) should not capture
      const div = new MockElement('div', { textContent: 'plain text' });
      clickHandler({ target: div });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('SPA Pageview Tracking', () => {
    it('captures initial pageview on init and on pushState, replaceState, popstate', async () => {
      init('ot_live_test_key', {
        capture_pageview: true,
      });

      // Initial pageview sent on init
      expect(mockFetch).toHaveBeenCalledTimes(1);
      let body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.event).toBe('$pageview');
      expect(body.properties.$pathname).toBe('/dashboard');

      // SPA navigation via pushState
      window.history.pushState({}, '', '/features');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.event).toBe('$pageview');
      expect(body.properties.$pathname).toBe('/features');

      // pushState to same URL should NOT fire a duplicate pageview
      window.history.pushState({}, '', '/features');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // SPA navigation via replaceState
      window.history.replaceState({}, '', '/settings');
      expect(mockFetch).toHaveBeenCalledTimes(3);
      body = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(body.event).toBe('$pageview');
      expect(body.properties.$pathname).toBe('/settings');

      // SPA navigation via popstate event
      (window.location as any).href = 'https://analytics.example.com/pricing';
      window.dispatchEvent({ type: 'popstate' });
      expect(mockFetch).toHaveBeenCalledTimes(4);
      body = JSON.parse(mockFetch.mock.calls[3][1].body);
      expect(body.event).toBe('$pageview');
      expect(body.properties.$pathname).toBe('/pricing');
    });

    it('does not capture pageviews if capture_pageview is false', async () => {
      init('ot_live_test_key', {
        capture_pageview: false,
      });

      expect(mockFetch).not.toHaveBeenCalled();
      window.history.pushState({}, '', '/features');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Offline Queue and Transport Resiliency', () => {
    it('queues events when navigator.onLine is false and flushes when online fires', async () => {
      init('ot_live_test_key', { capture_pageview: false });

      // Put navigator offline
      (window.navigator as any).onLine = false;

      const success = await capture('offline_event_1');
      expect(success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();

      await capture('offline_event_2');
      expect(getEventQueue().length).toBe(2);

      // Reconnect online
      (window.navigator as any).onLine = true;
      window.dispatchEvent({ type: 'online' });

      // Queue items should flush via fetch
      // Wait microtask tick for async flushQueue
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(getEventQueue().length).toBe(0);

      const firstFlushed = JSON.parse(mockFetch.mock.calls[0][1].body);
      const secondFlushed = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(firstFlushed.event).toBe('offline_event_1');
      expect(secondFlushed.event).toBe('offline_event_2');
    });

    it('queues events when fetch fails and flushes when next event succeeds', async () => {
      init('ot_live_test_key', { capture_pageview: false });

      // First fetch fails with network error
      mockFetch.mockRejectedValueOnce(new Error('Network drop'));

      const firstResult = await capture('failed_event');
      expect(firstResult).toBe(false);
      expect(getEventQueue().length).toBe(1);

      // Next capture succeeds
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      });

      const secondResult = await capture('succeeded_event');
      expect(secondResult).toBe(true);

      // Wait microtask tick for async flush
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Both events should have been dispatched now
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1st (failed), 2nd (succeeded), 3rd (queued flush)
      expect(getEventQueue().length).toBe(0);
    });

    it('flushes queued events using navigator.sendBeacon upon visibilitychange hidden or pagehide', async () => {
      init('ot_live_test_key', { capture_pageview: false });

      (window.navigator as any).onLine = false;
      await capture('tab_close_event');
      expect(getEventQueue().length).toBe(1);

      // Document hidden triggers unload handler
      (window.document as any).visibilityState = 'hidden';
      (window.document as any).dispatchEvent({ type: 'visibilitychange' });

      expect(window.navigator.sendBeacon).toHaveBeenCalledTimes(1);
      expect(getEventQueue().length).toBe(0);

      const [endpoint, blob] = (window.navigator.sendBeacon as any).mock.calls[0];
      expect(endpoint).toBe('/api/v1/capture');
      expect(blob).toBeDefined();
    });
  });

  describe('Default export and singleton instance', () => {
    it('exports default opentrack instance with identical methods', () => {
      expect(opentrack.init).toBe(init);
      expect(opentrack.capture).toBe(capture);
      expect(opentrack.identify).toBe(identify);
      expect(opentrack.getDistinctId).toBe(getDistinctId);
      expect(opentrack.getSessionId).toBe(getSessionId);
      expect(opentrack.reset).toBe(reset);
    });
  });
});
