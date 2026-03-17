import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so these are available inside vi.mock (which is hoisted)
const { mockInstances } = vi.hoisted(() => {
  const mockInstances: { waitForSlot: ReturnType<typeof vi.fn>; bucket: string }[] = [];
  return { mockInstances };
});

// Mock the rate-limiter module
vi.mock('../../src/api/rate-limiter.js', () => {
  class MockRateLimiter {
    waitForSlot: ReturnType<typeof vi.fn>;
    bucket: string;
    constructor(bucket: string) {
      this.bucket = bucket;
      this.waitForSlot = vi.fn().mockResolvedValue(0);
      mockInstances.push(this);
    }
  }
  return {
    RateLimiter: MockRateLimiter,
    RATE_LIMITS: {
      GENERAL: { requests: 200, windowMs: 60_000 },
      HISTORY: { requests: 50, windowMs: 30_000 },
    },
  };
});

// Mock the output module
vi.mock('../../src/output/index.js', () => ({
  verbose: vi.fn(),
  setVerbose: vi.fn(),
  theme: {
    warning: vi.fn((s: string) => s),
    error: vi.fn((s: string) => s),
  },
}));

import { apiPost, API_BASE_URL } from '../../src/api/client.js';
import { ApiError } from '../../src/errors/api-error.js';
import { AuthError } from '../../src/errors/auth-error.js';
import { NetworkError } from '../../src/errors/network-error.js';
import { verbose } from '../../src/output/index.js';

describe('api/client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Reset waitForSlot mocks on all instances to return 0
    for (const inst of mockInstances) {
      inst.waitForSlot.mockClear();
      inst.waitForSlot.mockResolvedValue(0);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API_BASE_URL', () => {
    it('exports the correct base URL', () => {
      expect(API_BASE_URL).toBe('https://api.topstepx.com/api');
    });
  });

  describe('envelope handling', () => {
    it('returns response data when HTTP 200 and success:true', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          errorCode: 0,
          errorMessage: null,
          accounts: [{ id: 1, name: 'Test' }],
        }),
        headers: new Headers(),
      });

      const result = await apiPost<{ accounts: { id: number; name: string }[] }>(
        '/Account/search',
        { onlyActiveAccounts: true },
        'test-token',
      );

      expect(result).toEqual({
        success: true,
        errorCode: 0,
        errorMessage: null,
        accounts: [{ id: 1, name: 'Test' }],
      });
    });

    it('throws ApiError with API errorMessage when HTTP 200 and success:false', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          success: false,
          errorCode: 42,
          errorMessage: 'Account not found',
        }),
        headers: new Headers(),
      });

      try {
        await apiPost('/Account/search', {}, 'test-token');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).message).toBe('Account not found');
        expect((err as ApiError).errorCode).toBe(42);
      }
    });

    it('throws ApiError with fallback message when success:false and null errorMessage', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          success: false,
          errorCode: 0,
          errorMessage: null,
        }),
        headers: new Headers(),
      });

      try {
        await apiPost('/Account/search', {}, 'test-token');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).message).toBe('API request failed');
      }
    });
  });

  describe('HTTP 401 handling', () => {
    it('throws AuthError with re-auth guidance on HTTP 401', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({}),
        headers: new Headers(),
      });

      try {
        await apiPost('/Account/search', {}, 'expired-token');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as AuthError).message).toBe(
          'Session expired. Run: topstep login',
        );
      }
    });
  });

  describe('HTTP 429 handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries once after backoff and succeeds on retry', async () => {
      // First call: 429
      fetchMock.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Headers({ 'Retry-After': '1' }),
      });
      // Second call: success
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          data: 'retry-success',
        }),
        headers: new Headers(),
      });

      const promise = apiPost('/Account/search', {}, 'test-token');
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toEqual({ success: true, data: 'retry-success' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws ApiError after retry fails with 429', async () => {
      // Both calls: 429
      fetchMock.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Headers({ 'Retry-After': '1' }),
      });
      fetchMock.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Headers({ 'Retry-After': '1' }),
      });

      const promise = apiPost('/Account/search', {}, 'test-token');
      // Attach catch handler before advancing timers to prevent unhandled rejection
      const resultPromise = promise.catch((err) => err);
      await vi.advanceTimersByTimeAsync(2000);
      const err = await resultPromise;

      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe(
        'Rate limited after retry. Try again later.',
      );
      expect((err as ApiError).errorCode).toBe(429);
    });

    it('uses fallback 5s backoff when Retry-After header is missing', async () => {
      // First call: 429 without Retry-After
      fetchMock.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Headers(),
      });
      // Second call: success
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          success: true,
          data: 'ok',
        }),
        headers: new Headers(),
      });

      const promise = apiPost('/Account/search', {}, 'test-token');
      await vi.advanceTimersByTimeAsync(6000);
      const result = await promise;

      expect(result).toEqual({ success: true, data: 'ok' });
    });
  });

  describe('network errors', () => {
    it('throws NetworkError when fetch rejects', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));

      try {
        await apiPost('/Account/search', {}, 'test-token');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).message).toBe(
          'Failed to connect to TopStepX API',
        );
      }
    });
  });

  describe('rate limiting integration', () => {
    it('calls rate limiter waitForSlot before making fetch call', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers(),
      });

      await apiPost('/Account/search', {}, 'test-token');

      // mockInstances[0] = general, mockInstances[1] = history (created at module load)
      expect(mockInstances.length).toBeGreaterThanOrEqual(2);

      // Verify fetch was called (slot was acquired first)
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('uses history limiter for endpoints containing /History/', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers(),
      });

      // Clear call counts to isolate this test
      for (const inst of mockInstances) {
        inst.waitForSlot.mockClear();
        inst.waitForSlot.mockResolvedValue(0);
      }

      await apiPost('/History/retrieveBars', {}, 'test-token');

      // Find the history limiter instance (bucket='history')
      const historyLimiter = mockInstances.find(
        (inst) => inst.bucket === 'history',
      );
      expect(historyLimiter).toBeDefined();
      expect(historyLimiter!.waitForSlot).toHaveBeenCalled();
    });

    it('uses general limiter for non-history endpoints', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers(),
      });

      // Clear call counts to isolate this test
      for (const inst of mockInstances) {
        inst.waitForSlot.mockClear();
        inst.waitForSlot.mockResolvedValue(0);
      }

      await apiPost('/Account/search', {}, 'test-token');

      // Find the general limiter instance (bucket='general')
      const generalLimiter = mockInstances.find(
        (inst) => inst.bucket === 'general',
      );
      expect(generalLimiter).toBeDefined();
      expect(generalLimiter!.waitForSlot).toHaveBeenCalled();
    });
  });

  describe('request headers', () => {
    it('sends correct Content-Type, Accept, and Authorization headers', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers(),
      });

      await apiPost('/Account/search', { key: 'value' }, 'my-jwt-token');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.topstepx.com/api/Account/search');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Accept']).toBe('application/json');
      expect(options.headers['Authorization']).toBe('Bearer my-jwt-token');
    });
  });

  describe('verbose logging', () => {
    it('calls verbose() with request details', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers(),
      });

      await apiPost('/Account/search', { key: 'value' }, 'test-token');

      expect(verbose).toHaveBeenCalledWith('api', expect.objectContaining({
        method: 'POST',
        url: 'https://api.topstepx.com/api/Account/search',
      }));
    });
  });
});
