import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Exit } from 'effect';
import {
  validatePayload,
  validateBatchPayload,
  hashClientIp,
  verifyApiKey,
  verifyAllowedDomains,
  isDomainAllowed,
  ingestEvent,
  ingestBatch,
} from './service';
import {
  parseUserAgent,
  extractGeoDetails,
  extractUrlAndReferrerDetails,
  enrichEventFields,
} from './enrichment';
import {
  PayloadValidationError,
  InvalidApiKeyError,
  DomainNotAllowedError,
} from './errors';
import { db } from '@/lib/db';
import { projects, events, persons, personAliases } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

describe('Ingestion Slice — Service, Enrichment & Validation', () => {
  const testApiKey = `ot_live_test_ingestion_${Date.now()}`;
  let testProjectId: string;

  beforeAll(async () => {
    const [inserted] = await db
      .insert(projects)
      .values({
        name: 'Ingestion Integration Test Project',
        slug: `test-ingestion-${Date.now()}`,
        clerkUserId: 'test_user_ingest',
        apiKey: testApiKey,
        allowedDomains: ['opentrack.dev', 'localhost'],
      })
      .returning();
    testProjectId = inserted.id;
  });

  afterAll(async () => {
    if (testProjectId) {
      await db.delete(events).where(eq(events.projectId, testProjectId));
      await db.delete(personAliases).where(eq(personAliases.projectId, testProjectId));
      await db.delete(persons).where(eq(persons.projectId, testProjectId));
      await db.delete(projects).where(eq(projects.id, testProjectId));
    }
  });

  describe('hashClientIp', () => {
    it('returns null when clientIp is null or undefined', () => {
      expect(hashClientIp(null)).toBeNull();
      expect(hashClientIp(undefined)).toBeNull();
      expect(hashClientIp('')).toBeNull();
    });

    it('returns deterministic SHA-256 hash', () => {
      const hash1 = hashClientIp('192.168.1.1');
      const hash2 = hashClientIp('192.168.1.1');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('handles multiple forwarded IPs in x-forwarded-for header', () => {
      const hashSingle = hashClientIp('203.0.113.195');
      const hashMultiple = hashClientIp('203.0.113.195, 70.41.3.18, 150.172.238.178');
      expect(hashMultiple).toBe(hashSingle);
    });
  });

  describe('parseUserAgent', () => {
    it('returns null values for empty input', () => {
      expect(parseUserAgent(null)).toEqual({
        browser: null,
        browserVersion: null,
        os: null,
        deviceType: null,
      });
      expect(parseUserAgent('')).toEqual({
        browser: null,
        browserVersion: null,
        os: null,
        deviceType: null,
      });
    });

    it('parses Chrome on Windows desktop', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const parsed = parseUserAgent(ua);
      expect(parsed.browser).toBe('Chrome');
      expect(parsed.browserVersion).toBe('122.0.0.0');
      expect(parsed.os).toBe('Windows');
      expect(parsed.deviceType).toBe('desktop');
    });

    it('parses Edge on Windows desktop', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.92';
      const parsed = parseUserAgent(ua);
      expect(parsed.browser).toBe('Edge');
      expect(parsed.browserVersion).toBe('122.0.2365.92');
      expect(parsed.os).toBe('Windows');
      expect(parsed.deviceType).toBe('desktop');
    });

    it('parses Mobile Safari on iPhone', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
      const parsed = parseUserAgent(ua);
      expect(parsed.browser).toBe('Mobile Safari');
      expect(parsed.browserVersion).toBe('17.4');
      expect(parsed.os).toBe('iOS');
      expect(parsed.deviceType).toBe('mobile');
    });

    it('parses Safari on macOS desktop', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15';
      const parsed = parseUserAgent(ua);
      expect(parsed.browser).toBe('Safari');
      expect(parsed.browserVersion).toBe('17.3');
      expect(parsed.os).toBe('macOS');
      expect(parsed.deviceType).toBe('desktop');
    });

    it('parses iPad tablet', () => {
      const ua =
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
      const parsed = parseUserAgent(ua);
      expect(parsed.browser).toBe('Mobile Safari');
      expect(parsed.deviceType).toBe('tablet');
      expect(parsed.os).toBe('iOS');
    });

    it('parses Android tablet', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 14; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const parsed = parseUserAgent(ua);
      expect(parsed.browser).toBe('Chrome');
      expect(parsed.deviceType).toBe('tablet');
      expect(parsed.os).toBe('Android');
    });

    it('parses Firefox on Linux', () => {
      const ua =
        'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0';
      const parsed = parseUserAgent(ua);
      expect(parsed.browser).toBe('Firefox');
      expect(parsed.browserVersion).toBe('123.0');
      expect(parsed.os).toBe('Linux');
      expect(parsed.deviceType).toBe('desktop');
    });

    it('parses web crawler / bot', () => {
      const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
      const parsed = parseUserAgent(ua);
      expect(parsed.deviceType).toBe('bot');
      expect(parsed.browser).toBe('Googlebot');
    });
  });

  describe('extractGeoDetails', () => {
    it('extracts geo headers correctly', () => {
      const headers = new Headers({
        'x-vercel-ip-country': 'us',
        'x-vercel-ip-country-region': 'CA',
        'x-vercel-ip-city': 'San%20Francisco',
      });
      const geo = extractGeoDetails(headers);
      expect(geo.countryCode).toBe('US');
      expect(geo.region).toBe('CA');
      expect(geo.city).toBe('San Francisco');
    });

    it('falls back to cf-ipcountry and cf-ipcity', () => {
      const headers = {
        'cf-ipcountry': 'de',
        'cf-region': 'BE',
        'cf-ipcity': 'Berlin',
      };
      const geo = extractGeoDetails(headers);
      expect(geo.countryCode).toBe('DE');
      expect(geo.region).toBe('BE');
      expect(geo.city).toBe('Berlin');
    });
  });

  describe('extractUrlAndReferrerDetails', () => {
    it('parses page URL, path, referrer domain and UTM parameters', () => {
      const props = {
        $current_url:
          'https://opentrack.dev/pricing?utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_term=saas&utm_content=banner',
        $referrer: 'https://news.ycombinator.com/item?id=12345',
        $screen_width: 1920,
        $screen_height: 1080,
      };

      const res = extractUrlAndReferrerDetails(props);
      expect(res.pageUrl).toBe(props.$current_url);
      expect(res.pagePath).toBe('/pricing');
      expect(res.referrer).toBe(props.$referrer);
      expect(res.referrerDomain).toBe('news.ycombinator.com');
      expect(res.utmSource).toBe('twitter');
      expect(res.utmMedium).toBe('social');
      expect(res.utmCampaign).toBe('launch');
      expect(res.utmTerm).toBe('saas');
      expect(res.utmContent).toBe('banner');
      expect(res.screenWidth).toBe(1920);
      expect(res.screenHeight).toBe(1080);
    });

    it('prefers direct properties for UTM overrides', () => {
      const props = {
        $current_url: 'https://opentrack.dev/home',
        utm_source: 'newsletter',
        utm_medium: 'email',
      };
      const res = extractUrlAndReferrerDetails(props);
      expect(res.utmSource).toBe('newsletter');
      expect(res.utmMedium).toBe('email');
    });
  });

  describe('Domain Verification: isDomainAllowed & verifyAllowedDomains', () => {
    it('matches exact domain and subdomains', () => {
      expect(isDomainAllowed('opentrack.dev', ['opentrack.dev'])).toBe(true);
      expect(isDomainAllowed('sub.opentrack.dev', ['opentrack.dev'])).toBe(true);
      expect(isDomainAllowed('localhost', ['localhost'])).toBe(true);
      expect(isDomainAllowed('evil.com', ['opentrack.dev'])).toBe(false);
    });

    it('fails when origin is disallowed', async () => {
      const dummyProject = {
        id: '123',
        name: 'Test',
        slug: 'test',
        clerkUserId: 'u1',
        clerkOrgId: null,
        apiKey: 'ot_live_test',
        secretKey: null,
        allowedDomains: ['opentrack.dev'],
        timezone: 'UTC',
        dataRetentionDays: 365,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const exit = await Effect.runPromiseExit(
        verifyAllowedDomains(dummyProject, 'https://malicious.com')
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(JSON.stringify(exit.cause)).toContain('DomainNotAllowedError');
      }
    });

    it('succeeds when origin is permitted', async () => {
      const dummyProject = {
        id: '123',
        name: 'Test',
        slug: 'test',
        clerkUserId: 'u1',
        clerkOrgId: null,
        apiKey: 'ot_live_test',
        secretKey: null,
        allowedDomains: ['opentrack.dev'],
        timezone: 'UTC',
        dataRetentionDays: 365,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const exit = await Effect.runPromiseExit(
        verifyAllowedDomains(dummyProject, 'https://app.opentrack.dev/dashboard')
      );
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe('validatePayload', () => {
    it('succeeds with a valid payload', async () => {
      const validPayload = {
        api_key: 'ot_live_test_123',
        event: 'user_signed_up',
        distinct_id: 'user_456',
        session_id: 'sess_789',
        properties: { plan: 'pro', source: 'pricing' },
        timestamp: Date.now(),
      };

      const exit = await Effect.runPromiseExit(validatePayload(validPayload));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.event).toBe('user_signed_up');
        expect(exit.value.api_key).toBe('ot_live_test_123');
      }
    });

    it('fails with PayloadValidationError when required fields are missing', async () => {
      const invalidPayload = {
        api_key: 'ot_live_test_123',
        // missing event
        distinct_id: 'user_456',
      };

      const exit = await Effect.runPromiseExit(validatePayload(invalidPayload));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause;
        expect(JSON.stringify(error)).toContain('PayloadValidationError');
      }
    });

    it('fails when api_key is empty string', async () => {
      const invalidPayload = {
        api_key: '',
        event: 'test_event',
        distinct_id: 'user_123',
      };

      const exit = await Effect.runPromiseExit(validatePayload(invalidPayload));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(JSON.stringify(exit.cause)).toContain('PayloadValidationError');
      }
    });

    it('allows omitting distinct_id for $identify if in properties', async () => {
      const identifyPayload = {
        api_key: 'ot_live_test',
        event: '$identify',
        properties: { distinct_id: 'user_ident_123', email: 'test@example.com' },
      };
      const exit = await Effect.runPromiseExit(validatePayload(identifyPayload));
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe('validateBatchPayload', () => {
    it('succeeds with array format', async () => {
      const batch = [
        { event: 'click_1', distinct_id: 'u1' },
        { event: 'click_2', distinct_id: 'u2' },
      ];
      const exit = await Effect.runPromiseExit(validateBatchPayload(batch));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.batch).toHaveLength(2);
      }
    });

    it('succeeds with wrapper object format', async () => {
      const wrapper = {
        api_key: 'ot_live_test',
        batch: [{ event: 'view', distinct_id: 'u1' }],
      };
      const exit = await Effect.runPromiseExit(validateBatchPayload(wrapper));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.apiKey).toBe('ot_live_test');
        expect(exit.value.batch).toHaveLength(1);
      }
    });

    it('fails when batch is empty', async () => {
      const exit = await Effect.runPromiseExit(validateBatchPayload([]));
      expect(Exit.isFailure(exit)).toBe(true);
    });

    it('fails when batch exceeds 100 items', async () => {
      const tooMany = Array.from({ length: 101 }, (_, i) => ({
        event: `evt_${i}`,
        distinct_id: `user_${i}`,
      }));
      const exit = await Effect.runPromiseExit(validateBatchPayload(tooMany));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(JSON.stringify(exit.cause)).toContain('cannot exceed 100');
      }
    });
  });

  describe('verifyApiKey', () => {
    it('fails with InvalidApiKeyError for unknown api key', async () => {
      const exit = await Effect.runPromiseExit(verifyApiKey('ot_live_non_existent_key_999999'));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(JSON.stringify(exit.cause)).toContain('InvalidApiKeyError');
      }
    });

    it('succeeds for valid project api key', async () => {
      const exit = await Effect.runPromiseExit(verifyApiKey(testApiKey));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.id).toBe(testProjectId);
      }
    });
  });

  describe('ingestEvent workflow', () => {
    it('fails with PayloadValidationError before DB query if payload is invalid', async () => {
      const exit = await Effect.runPromiseExit(ingestEvent({}));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(JSON.stringify(exit.cause)).toContain('PayloadValidationError');
      }
    });

    it('fails with InvalidApiKeyError if payload has valid structure but unknown key', async () => {
      const exit = await Effect.runPromiseExit(
        ingestEvent({
          api_key: 'ot_live_definitely_not_a_valid_project_key',
          event: 'page_view',
          distinct_id: 'anon_123',
        })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(JSON.stringify(exit.cause)).toContain('InvalidApiKeyError');
      }
    });

    it('successfully enriches and ingests single event with geo, UA and UTMs', async () => {
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const headers = new Headers({
        'user-agent': userAgent,
        'x-vercel-ip-country': 'US',
        'x-vercel-ip-country-region': 'CA',
        'x-vercel-ip-city': 'San%20Francisco',
        origin: 'https://opentrack.dev',
      });

      const payload = {
        api_key: testApiKey,
        event: 'checkout_step_1',
        distinct_id: 'cust_987',
        properties: {
          $current_url: 'https://opentrack.dev/cart?utm_source=newsletter&utm_medium=email',
          $referrer: 'https://google.com/search?q=opentrack',
          $screen_width: 1440,
          $screen_height: 900,
          cart_total: 99.5,
        },
      };

      const exit = await Effect.runPromiseExit(
        ingestEvent(payload, {
          clientIp: '198.51.100.25',
          headers,
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        const saved = exit.value;
        expect(saved.id).toBeDefined();
        expect(saved.projectId).toBe(testProjectId);
        expect(saved.eventName).toBe('checkout_step_1');
        expect(saved.distinctId).toBe('cust_987');
        expect(saved.browser).toBe('Chrome');
        expect(saved.os).toBe('Windows');
        expect(saved.deviceType).toBe('desktop');
        expect(saved.countryCode).toBe('US');
        expect(saved.region).toBe('CA');
        expect(saved.city).toBe('San Francisco');
        expect(saved.pagePath).toBe('/cart');
        expect(saved.utmSource).toBe('newsletter');
        expect(saved.utmMedium).toBe('email');
        expect(saved.referrerDomain).toBe('google.com');
        expect(saved.screenWidth).toBe(1440);
        expect(saved.screenHeight).toBe(900);
      }
    });

    it('rejects event with DomainNotAllowedError when origin does not match allowedDomains', async () => {
      const headers = new Headers({
        origin: 'https://unauthorized-domain.com',
      });

      const exit = await Effect.runPromiseExit(
        ingestEvent(
          {
            api_key: testApiKey,
            event: 'test_origin_blocked',
            distinct_id: 'user_origin_block',
          },
          { headers }
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(JSON.stringify(exit.cause)).toContain('DomainNotAllowedError');
      }
    });

    it('handles $identify event and creates persons and person_aliases', async () => {
      const identifiedUser = `user_identified_${Date.now()}`;
      const anonDistinctId = `anon_${Date.now()}`;

      const exit = await Effect.runPromiseExit(
        ingestEvent({
          api_key: testApiKey,
          event: '$identify',
          distinct_id: identifiedUser,
          alias: anonDistinctId,
          properties: {
            email: 'dev@opentrack.dev',
            plan: 'enterprise',
          },
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);

      // Verify person was created
      const [personRow] = await db
        .select()
        .from(persons)
        .where(
          and(
            eq(persons.projectId, testProjectId),
            eq(persons.distinctId, identifiedUser)
          )
        )
        .limit(1);

      expect(personRow).toBeDefined();
      expect(personRow.distinctId).toBe(identifiedUser);
      expect((personRow.properties as any)?.email).toBe('dev@opentrack.dev');

      // Verify alias was created
      const [aliasRow] = await db
        .select()
        .from(personAliases)
        .where(
          and(
            eq(personAliases.projectId, testProjectId),
            eq(personAliases.aliasId, anonDistinctId)
          )
        )
        .limit(1);

      expect(aliasRow).toBeDefined();
      expect(aliasRow.personDistinctId).toBe(identifiedUser);
    });

    it('handles $alias event and links alias to person', async () => {
      const targetUser = `user_alias_target_${Date.now()}`;
      const secondAlias = `anon_alias_${Date.now()}`;

      const exit = await Effect.runPromiseExit(
        ingestEvent({
          api_key: testApiKey,
          event: '$alias',
          distinct_id: targetUser,
          alias: secondAlias,
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);

      const [aliasRow] = await db
        .select()
        .from(personAliases)
        .where(
          and(
            eq(personAliases.projectId, testProjectId),
            eq(personAliases.aliasId, secondAlias)
          )
        )
        .limit(1);

      expect(aliasRow).toBeDefined();
      expect(aliasRow.personDistinctId).toBe(targetUser);
    });
  });

  describe('ingestBatch workflow', () => {
    it('successfully ingests a batch of events', async () => {
      const batchPayload = {
        api_key: testApiKey,
        batch: [
          {
            event: 'batch_event_1',
            distinct_id: 'user_batch_1',
            properties: { step: 1 },
          },
          {
            event: 'batch_event_2',
            distinct_id: 'user_batch_1',
            properties: { step: 2 },
          },
          {
            event: 'batch_event_3',
            distinct_id: 'user_batch_2',
            properties: { step: 3 },
          },
        ],
      };

      const exit = await Effect.runPromiseExit(
        ingestBatch(batchPayload, {
          clientIp: '198.51.100.77',
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toHaveLength(3);
        expect(exit.value[0].eventName).toBe('batch_event_1');
        expect(exit.value[1].eventName).toBe('batch_event_2');
        expect(exit.value[2].eventName).toBe('batch_event_3');
      }
    });

    it('supports API key supplied via options/header when omitting from batch items', async () => {
      const batchPayload = [
        {
          event: 'header_keyed_event_1',
          distinct_id: 'user_hk_1',
        },
        {
          event: 'header_keyed_event_2',
          distinct_id: 'user_hk_2',
        },
      ];

      const exit = await Effect.runPromiseExit(
        ingestBatch(batchPayload, {
          apiKey: testApiKey,
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toHaveLength(2);
      }
    });
  });
});
