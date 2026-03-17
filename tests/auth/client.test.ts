import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the output module to suppress verbose logging in tests
vi.mock('../../src/output/index.js', () => ({
  verbose: vi.fn(),
  setVerbose: vi.fn(),
}));

import { login, refreshToken } from '../../src/auth/client.js';
import { AuthError } from '../../src/errors/auth-error.js';
import { NetworkError } from '../../src/errors/network-error.js';

describe('auth/client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('login', () => {
    it('returns token string on successful login', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errorCode: 0,
          errorMessage: null,
          token: 'jwt-token-abc123',
        }),
      });

      const token = await login('testuser', 'api-key-123');
      expect(token).toBe('jwt-token-abc123');
    });

    it('sends POST to correct URL with correct body and headers', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errorCode: 0,
          errorMessage: null,
          token: 'jwt-token',
        }),
      });

      await login('myuser', 'mykey');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.topstepx.com/api/Auth/loginKey');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Accept']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual({
        userName: 'myuser',
        apiKey: 'mykey',
      });
    });

    it('throws AuthError with API errorMessage when success is false', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          errorCode: 401,
          errorMessage: 'Invalid API key',
          token: '',
        }),
      });

      try {
        await login('testuser', 'bad-key');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as Error).message).toBe('Login failed: Invalid API key');
      }
    });

    it('throws AuthError with Unknown error when errorMessage is null', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          errorCode: 500,
          errorMessage: null,
          token: '',
        }),
      });

      try {
        await login('testuser', 'key');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as Error).message).toBe('Login failed: Unknown error');
      }
    });

    it('throws NetworkError when fetch rejects', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));

      try {
        await login('testuser', 'key');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as Error).message).toBe(
          'Failed to connect to TopStepX API',
        );
      }
    });
  });

  describe('refreshToken', () => {
    it('returns new token string on successful validation', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errorCode: 0,
          errorMessage: null,
          newToken: 'new-jwt-token-xyz',
        }),
      });

      const newToken = await refreshToken('old-jwt-token');
      expect(newToken).toBe('new-jwt-token-xyz');
    });

    it('sends POST to validate URL with Bearer Authorization header', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errorCode: 0,
          errorMessage: null,
          newToken: 'refreshed-token',
        }),
      });

      await refreshToken('my-token-123');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.topstepx.com/api/Auth/validate');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer my-token-123');
    });

    it('throws AuthError with login guidance when success is false', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          errorCode: 401,
          errorMessage: 'Token expired',
          newToken: '',
        }),
      });

      try {
        await refreshToken('expired-token');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as Error).message).toBe(
          'Token refresh failed. Run: topstep login',
        );
      }
    });

    it('throws NetworkError when fetch rejects', async () => {
      fetchMock.mockRejectedValueOnce(new Error('DNS resolution failed'));

      try {
        await refreshToken('token');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as Error).message).toBe(
          'Failed to connect to TopStepX API',
        );
      }
    });
  });
});
