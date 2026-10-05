export function detectBrowser(ua = ''): string {
  if (!ua && typeof navigator !== 'undefined') {
    ua = navigator.userAgent || '';
  }
  if (!ua) return 'Unknown';

  if (/edg([ea]|ios)?\/([0-9.]+)/i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) return 'Safari';
  return 'Unknown';
}

export function detectOS(ua = ''): string {
  if (!ua && typeof navigator !== 'undefined') {
    ua = navigator.userAgent || '';
  }
  if (!ua) return 'Unknown';

  if (/windows phone/i.test(ua)) return 'Windows Phone';
  if (/win(dows|98|me|nt|xp|vista|7|8|10|11)/i.test(ua)) return 'Windows';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

export function getUtmProperties(search?: string): Record<string, string> {
  const query =
    search !== undefined
      ? search
      : typeof window !== 'undefined' && window.location
        ? window.location.search
        : '';

  if (!query) return {};

  const utmMap: Record<string, string> = {
    utm_source: '$utm_source',
    utm_medium: '$utm_medium',
    utm_campaign: '$utm_campaign',
    utm_term: '$utm_term',
    utm_content: '$utm_content',
  };

  const result: Record<string, string> = {};
  try {
    const params = new URLSearchParams(query);
    for (const [param, propKey] of Object.entries(utmMap)) {
      const val = params.get(param);
      if (val) {
        result[propKey] = val;
      }
    }
  } catch {
    // Ignore URL parsing errors
  }
  return result;
}

export function getAutomaticProperties(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};

  const props: Record<string, unknown> = {};

  if (window.location) {
    if (window.location.href) props.$current_url = window.location.href;
    if (window.location.pathname) props.$pathname = window.location.pathname;
    Object.assign(props, getUtmProperties());
  }

  if (typeof document !== 'undefined' && document.referrer) {
    props.$referrer = document.referrer;
  }

  if (typeof navigator !== 'undefined') {
    props.$browser = detectBrowser(navigator.userAgent);
    props.$os = detectOS(navigator.userAgent);
  }

  if (typeof window.screen !== 'undefined') {
    if (typeof window.screen.width === 'number') props.$screen_width = window.screen.width;
    if (typeof window.screen.height === 'number') props.$screen_height = window.screen.height;
  }

  return props;
}
