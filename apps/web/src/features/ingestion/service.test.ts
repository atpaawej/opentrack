import { describe, it, expect, vi } from 'vitest';
import { Effect, Exit } from 'effect';
import {
  validatePayload,
  hashClientIp,
  verifyApiKey,
  ingestEvent,
} from './service';
import { PayloadValidationError, InvalidApiKeyError } from './errors';

describe('Ingestion Slice — Service & Validation', () => {
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
  });

  describe('verifyApiKey', () => {
    it('fails with InvalidApiKeyError for unknown api key', async () => {
      const exit = await Effect.runPromiseExit(verifyApiKey('ot_live_non_existent_key_999999'));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(JSON.stringify(exit.cause)).toContain('InvalidApiKeyError');
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
  });
});
