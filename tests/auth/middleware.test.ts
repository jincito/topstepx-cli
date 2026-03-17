import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the token module
vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
  saveToken: vi.fn(),
  isTokenExpiringSoon: vi.fn(),
  decodeJwtPayload: vi.fn(),
  clearToken: vi.fn(),
  getTokenPath: vi.fn(),
}));

// Mock the client module
vi.mock('../../src/auth/client.js', () => ({
  refreshToken: vi.fn(),
  login: vi.fn(),
  API_BASE_URL: 'https://api.topstepx.com/api',
}));

// Mock the output module
vi.mock('../../src/output/index.js', () => ({
  verbose: vi.fn(),
  setVerbose: vi.fn(),
  output: vi.fn(),
  theme: {
    success: (s: string) => s,
    error: (s: string) => s,
    muted: (s: string) => s,
  },
}));

import { ensureAuth } from '../../src/auth/middleware.js';
import { loadToken, saveToken, isTokenExpiringSoon, decodeJwtPayload } from '../../src/auth/token.js';
import { refreshToken } from '../../src/auth/client.js';
import { AuthError } from '../../src/errors/auth-error.js';

const mockLoadToken = vi.mocked(loadToken);
const mockSaveToken = vi.mocked(saveToken);
const mockIsExpiring = vi.mocked(isTokenExpiringSoon);
const mockDecodeJwt = vi.mocked(decodeJwtPayload);
const mockRefreshToken = vi.mocked(refreshToken);

/** Create a mock Command object with a name() method */
function mockCommand(name: string) {
  return { name: () => name } as { name(): string };
}

describe('ensureAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips auth for "login" command (returns empty string)', async () => {
    const result = await ensureAuth(mockCommand('login'));
    expect(result).toBe('');
    expect(mockLoadToken).not.toHaveBeenCalled();
  });

  it('skips auth for "logout" command (returns empty string)', async () => {
    const result = await ensureAuth(mockCommand('logout'));
    expect(result).toBe('');
    expect(mockLoadToken).not.toHaveBeenCalled();
  });

  it('skips auth for "status" command (handles its own auth display)', async () => {
    const result = await ensureAuth(mockCommand('status'));
    expect(result).toBe('');
    expect(mockLoadToken).not.toHaveBeenCalled();
  });

  it('skips auth for "help" command', async () => {
    const result = await ensureAuth(mockCommand('help'));
    expect(result).toBe('');
  });

  it('skips auth for "version" command', async () => {
    const result = await ensureAuth(mockCommand('version'));
    expect(result).toBe('');
  });

  it('throws AuthError when loadToken returns null', async () => {
    mockLoadToken.mockReturnValueOnce(null);

    try {
      await ensureAuth(mockCommand('accounts'));
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as Error).message).toContain('Not authenticated');
    }
  });

  it('returns cached token when isTokenExpiringSoon returns false', async () => {
    mockLoadToken.mockReturnValueOnce({
      token: 'valid-token',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      username: 'testuser',
    });
    mockIsExpiring.mockReturnValueOnce(false);

    const result = await ensureAuth(mockCommand('accounts'));
    expect(result).toBe('valid-token');
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('calls refreshToken and saveToken when isTokenExpiringSoon returns true', async () => {
    const cached = {
      token: 'expiring-token',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      username: 'testuser',
    };
    mockLoadToken.mockReturnValueOnce(cached);
    mockIsExpiring.mockReturnValueOnce(true);
    mockRefreshToken.mockResolvedValueOnce('new-refreshed-token');
    mockDecodeJwt.mockReturnValueOnce({
      exp: Math.floor(Date.now() / 1000) + 86400,
      iat: Math.floor(Date.now() / 1000),
    });

    await ensureAuth(mockCommand('accounts'));

    expect(mockRefreshToken).toHaveBeenCalledWith('expiring-token');
    expect(mockSaveToken).toHaveBeenCalledOnce();
    const savedArg = mockSaveToken.mock.calls[0][0];
    expect(savedArg.token).toBe('new-refreshed-token');
    expect(savedArg.username).toBe('testuser');
  });

  it('returns new token after successful refresh', async () => {
    mockLoadToken.mockReturnValueOnce({
      token: 'expiring-token',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      username: 'testuser',
    });
    mockIsExpiring.mockReturnValueOnce(true);
    mockRefreshToken.mockResolvedValueOnce('fresh-new-token');
    mockDecodeJwt.mockReturnValueOnce({
      exp: Math.floor(Date.now() / 1000) + 86400,
    });

    const result = await ensureAuth(mockCommand('accounts'));
    expect(result).toBe('fresh-new-token');
  });

  it('throws when refreshToken throws (does not swallow error)', async () => {
    mockLoadToken.mockReturnValueOnce({
      token: 'expiring-token',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      username: 'testuser',
    });
    mockIsExpiring.mockReturnValueOnce(true);
    mockRefreshToken.mockRejectedValueOnce(
      new AuthError('Token refresh failed. Run: topstep login'),
    );

    try {
      await ensureAuth(mockCommand('accounts'));
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as Error).message).toContain('Token refresh failed');
    }
  });
});
