export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot';

export interface UserAgentDetails {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  deviceType: DeviceType | null;
}

export function parseUserAgent(uaString: string | null | undefined): UserAgentDetails {
  if (!uaString || typeof uaString !== 'string') {
    return { browser: null, browserVersion: null, os: null, deviceType: null };
  }

  const ua = uaString.trim();
  if (!ua) {
    return { browser: null, browserVersion: null, os: null, deviceType: null };
  }

  let deviceType: DeviceType = 'desktop';
  let os: string | null = null;
  let browser: string | null = null;
  let browserVersion: string | null = null;

  // 1. Bot check
  const botMatch = ua.match(
    /(Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Slurp|facebookexternalhit|Twitterbot|LinkedInBot|bot|crawler|spider|curl|wget|python-requests|node-fetch|axios)/i
  );
  const isBot = Boolean(botMatch);

  // 2. Device Type check
  if (isBot) {
    deviceType = 'bot';
  } else if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    deviceType = 'mobile';
  } else {
    deviceType = 'desktop';
  }

  // 3. OS check
  if (/windows phone/i.test(ua)) {
    os = 'Windows Phone';
  } else if (/windows nt/i.test(ua) || /windows/i.test(ua)) {
    os = 'Windows';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/android/i.test(ua)) {
    os = 'Android';
  } else if (/cros/i.test(ua)) {
    os = 'Chrome OS';
  } else if (/linux|x11/i.test(ua)) {
    os = 'Linux';
  }

  // 4. Browser & Version check
  if (isBot && botMatch) {
    browser = botMatch[1] ?? 'Bot';
    const verMatch = ua.match(new RegExp(`${browser}[/ ]([0-9.]+)`, 'i'));
    browserVersion = verMatch ? verMatch[1] : null;
  } else if (/edg(?:e|a|ios)?\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/edg(?:e|a|ios)?\/([0-9.]+)/i);
    browser = 'Edge';
    browserVersion = match ? match[1] : null;
  } else if (/samsungbrowser\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/samsungbrowser\/([0-9.]+)/i);
    browser = 'Samsung Internet';
    browserVersion = match ? match[1] : null;
  } else if (/(?:opera|opr)\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/(?:opera|opr)\/([0-9.]+)/i);
    browser = 'Opera';
    browserVersion = match ? match[1] : null;
  } else if (/(?:firefox|fxios)\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/(?:firefox|fxios)\/([0-9.]+)/i);
    browser = 'Firefox';
    browserVersion = match ? match[1] : null;
  } else if (/(?:chrome|crios)\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/(?:chrome|crios)\/([0-9.]+)/i);
    browser = 'Chrome';
    browserVersion = match ? match[1] : null;
  } else if (/version\/([0-9.]+).*safari/i.test(ua) || /safari\/([0-9.]+)/i.test(ua)) {
    const verMatch = ua.match(/version\/([0-9.]+)/i) || ua.match(/safari\/([0-9.]+)/i);
    browser =
      deviceType === 'mobile' || deviceType === 'tablet' || os === 'iOS'
        ? 'Mobile Safari'
        : 'Safari';
    browserVersion = verMatch ? verMatch[1] : null;
  }

  return { browser, browserVersion, os, deviceType };
}

export interface GeoDetails {
  countryCode: string | null;
  region: string | null;
  city: string | null;
}

export type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

export function getHeaderValue(headers: HeaderSource, name: string): string | null {
  if (!headers) return null;
  if ('get' in headers && typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? null;
  }
  const map = headers as Record<string, string | string[] | undefined>;
  const val = map[name] ?? map[name.toLowerCase()] ?? map[name.toUpperCase()];
  if (Array.isArray(val)) return val[0] ?? null;
  return val ?? null;
}

export function extractGeoDetails(headers: HeaderSource): GeoDetails {
  const rawCountry =
    getHeaderValue(headers, 'x-vercel-ip-country') ||
    getHeaderValue(headers, 'cf-ipcountry');

  const countryCode = rawCountry ? rawCountry.trim().slice(0, 2).toUpperCase() : null;

  const region =
    getHeaderValue(headers, 'x-vercel-ip-country-region') ||
    getHeaderValue(headers, 'cf-region') ||
    getHeaderValue(headers, 'cf-region-code') ||
    null;

  const rawCity =
    getHeaderValue(headers, 'x-vercel-ip-city') ||
    getHeaderValue(headers, 'cf-ipcity');

  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity.trim());
    } catch {
      city = rawCity.trim();
    }
  }

  return { countryCode, region, city };
}

export interface UrlAndReferrerDetails {
  pageUrl: string | null;
  pagePath: string | null;
  referrer: string | null;
  referrerDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
}

export function extractUrlAndReferrerDetails(
  properties?: Record<string, unknown> | null,
  headerReferer?: string | null
): UrlAndReferrerDetails {
  const props = properties ?? {};

  // URL / Path
  const rawUrl =
    (props['$current_url'] ??
      props['current_url'] ??
      props['$page_url'] ??
      props['page_url'] ??
      props['url']) as string | undefined;

  const rawPath =
    (props['$pathname'] ??
      props['pathname'] ??
      props['$page_path'] ??
      props['page_path']) as string | undefined;

  let pageUrl: string | null = rawUrl ? String(rawUrl) : null;
  let pagePath: string | null = rawPath ? String(rawPath) : null;

  let urlObj: URL | null = null;
  if (pageUrl) {
    try {
      urlObj = new URL(pageUrl);
      if (!pagePath) {
        pagePath = urlObj.pathname;
      }
    } catch {
      if (!pagePath && pageUrl.startsWith('/')) {
        pagePath = pageUrl;
      }
    }
  }

  // Referrer & Referrer Domain
  const rawReferrer =
    (props['$referrer'] ??
      props['referrer'] ??
      headerReferer) as string | undefined;

  let referrer: string | null = rawReferrer ? String(rawReferrer) : null;
  let referrerDomain: string | null = null;

  if (referrer) {
    try {
      if (referrer.includes('://')) {
        referrerDomain = new URL(referrer).hostname;
      } else {
        referrerDomain = referrer.split('/')[0].split(':')[0].trim();
      }
    } catch {
      referrerDomain = null;
    }
  }

  // UTM Parameters
  const getUtm = (key: string): string | null => {
    const direct = props[key] ?? props[`$${key}`];
    if (direct !== undefined && direct !== null) {
      return String(direct);
    }
    if (urlObj) {
      return urlObj.searchParams.get(key) ?? null;
    }
    return null;
  };

  const utmSource = getUtm('utm_source');
  const utmMedium = getUtm('utm_medium');
  const utmCampaign = getUtm('utm_campaign');
  const utmTerm = getUtm('utm_term');
  const utmContent = getUtm('utm_content');

  // Screen dimensions
  const parseDimension = (val: unknown): number | null => {
    if (typeof val === 'number' && !isNaN(val)) return Math.round(val);
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const screenWidth = parseDimension(props['$screen_width'] ?? props['screen_width']);
  const screenHeight = parseDimension(props['$screen_height'] ?? props['screen_height']);

  return {
    pageUrl,
    pagePath,
    referrer,
    referrerDomain,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    screenWidth,
    screenHeight,
  };
}

export interface EnrichedEventFields {
  userAgent: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  deviceType: DeviceType | null;
  screenWidth: number | null;
  screenHeight: number | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  referrer: string | null;
  referrerDomain: string | null;
  pageUrl: string | null;
  pagePath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}

export function enrichEventFields(
  properties?: Record<string, unknown> | null,
  headers?: HeaderSource
): EnrichedEventFields {
  const props = properties ?? {};

  // 1. User Agent
  const rawUa = (getHeaderValue(headers, 'user-agent') ??
    props['$user_agent'] ??
    props['user_agent']) as string | undefined;
  const uaDetails = parseUserAgent(rawUa);

  const browser = (props['$browser'] ?? props['browser'] ?? uaDetails.browser) as string | null;
  const browserVersion = (props['$browser_version'] ??
    props['browser_version'] ??
    uaDetails.browserVersion) as string | null;
  const os = (props['$os'] ?? props['os'] ?? uaDetails.os) as string | null;
  const deviceType = ((props['$device_type'] ?? props['device_type'] ?? uaDetails.deviceType) as DeviceType) || null;

  // 2. Geo
  const headerGeo = extractGeoDetails(headers);
  const countryCode = (props['$geoip_country_code'] ??
    props['country_code'] ??
    headerGeo.countryCode) as string | null;
  const region = (props['$geoip_region'] ?? props['region'] ?? headerGeo.region) as string | null;
  const city = (props['$geoip_city'] ?? props['city'] ?? headerGeo.city) as string | null;

  // 3. URLs, Referrer & UTMs
  const headerReferer = getHeaderValue(headers, 'referer') ?? getHeaderValue(headers, 'referrer');
  const urlAndReferrer = extractUrlAndReferrerDetails(properties, headerReferer);

  return {
    userAgent: rawUa ? String(rawUa) : null,
    browser: browser ? String(browser) : null,
    browserVersion: browserVersion ? String(browserVersion) : null,
    os: os ? String(os) : null,
    deviceType,
    screenWidth: urlAndReferrer.screenWidth,
    screenHeight: urlAndReferrer.screenHeight,
    countryCode: countryCode ? String(countryCode).slice(0, 2).toUpperCase() : null,
    region: region ? String(region) : null,
    city: city ? String(city) : null,
    referrer: urlAndReferrer.referrer,
    referrerDomain: urlAndReferrer.referrerDomain,
    pageUrl: urlAndReferrer.pageUrl,
    pagePath: urlAndReferrer.pagePath,
    utmSource: urlAndReferrer.utmSource,
    utmMedium: urlAndReferrer.utmMedium,
    utmCampaign: urlAndReferrer.utmCampaign,
    utmTerm: urlAndReferrer.utmTerm,
    utmContent: urlAndReferrer.utmContent,
  };
}
