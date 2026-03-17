import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Mock getConfigDir to use temp directory
vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: vi.fn(),
  ensureConfigDir: vi.fn(),
}));

import { getConfigDir, ensureConfigDir } from '../../src/config/paths.js';
import {
  decodeJwtPayload,
  isTokenExpiringSoon,
  getTokenPath,
  saveToken,
  loadToken,
  clearToken,
} from '../../src/auth/token.js';
import type { TokenCache, JwtPayload } from '../../src/auth/token.js';

const mockedGetConfigDir = vi.mocked(getConfigDir);
const mockedEnsureConfigDir = vi.mocked(ensureConfigDir);

/** Helper: build a fake JWT from a payload object */
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('fake-signature').toString('base64url');
  return `${header}.${body}.${sig}`;
}

describe('decodeJwtPayload', () => {
  it('extracts exp and iat claims from a valid JWT', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt({ exp: now + 3600, iat: now, sub: 'user123' });
    const payload = decodeJwtPayload(token);
    expect(payload.exp).toBe(now + 3600);
    expect(payload.iat).toBe(now);
    expect(payload.sub).toBe('user123');
  });

  it('correctly extracts arbitrary claims', () => {
    const token = makeJwt({ foo: 'bar', num: 42, nested: { a: 1 } });
    const payload = decodeJwtPayload(token);
    expect(payload.foo).toBe('bar');
    expect(payload.num).toBe(42);
    expect(payload.nested).toEqual({ a: 1 });
  });

  it('throws AuthError for tokens with != 3 parts (too few)', () => {
    expect(() => decodeJwtPayload('only.two')).toThrow('Invalid JWT format');
  });

  it('throws AuthError for tokens with != 3 parts (too many)', () => {
    expect(() => decodeJwtPayload('a.b.c.d')).toThrow('Invalid JWT format');
  });

  it('throws AuthError for empty string', () => {
    expect(() => decodeJwtPayload('')).toThrow('Invalid JWT format');
  });
});

describe('isTokenExpiringSoon', () => {
  it('returns false for a freshly issued token (iat = now, exp = now + 24h)', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt({ iat: now, exp: now + 24 * 3600 });
    expect(isTokenExpiringSoon(token)).toBe(false);
  });

  it('returns true when token age >= 23 hours', () => {
    const now = Math.floor(Date.now() / 1000);
    const iat = now - 23 * 3600; // issued 23 hours ago
    const token = makeJwt({ iat, exp: now + 3600 }); // still valid but old
    expect(isTokenExpiringSoon(token)).toBe(true);
  });

  it('returns true when now >= exp (expired)', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt({ iat: now - 25 * 3600, exp: now - 3600 });
    expect(isTokenExpiringSoon(token)).toBe(true);
  });

  it('returns true when exp claim is missing', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt({ iat: now });
    expect(isTokenExpiringSoon(token)).toBe(true);
  });

  it('accepts custom thresholdHours parameter', () => {
    const now = Math.floor(Date.now() / 1000);
    const iat = now - 2 * 3600; // issued 2 hours ago
    const token = makeJwt({ iat, exp: now + 22 * 3600 });
    // With default 23h threshold: should be false
    expect(isTokenExpiringSoon(token)).toBe(false);
    // With 1h threshold: should be true (age 2h >= 1h)
    expect(isTokenExpiringSoon(token, 1)).toBe(true);
  });
});

describe('getTokenPath', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'topstepx-token-test-'));
    mockedGetConfigDir.mockReturnValue(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns path joining getConfigDir() with token.json', () => {
    const path = getTokenPath();
    expect(path).toBe(join(tempDir, 'token.json'));
  });
});

describe('saveToken / loadToken / clearToken', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'topstepx-token-test-'));
    mockedGetConfigDir.mockReturnValue(tempDir);
    mockedEnsureConfigDir.mockReturnValue(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('saveToken writes TokenCache JSON to disk', () => {
    const cache: TokenCache = {
      token: 'abc.def.ghi',
      acquiredAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-02T00:00:00Z',
      username: 'testuser',
    };
    saveToken(cache);
    const raw = readFileSync(join(tempDir, 'token.json'), 'utf-8');
    expect(JSON.parse(raw)).toEqual(cache);
  });

  it('saveToken writes file with mode 0o600', () => {
    const cache: TokenCache = {
      token: 'abc.def.ghi',
      acquiredAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-02T00:00:00Z',
      username: 'testuser',
    };
    saveToken(cache);
    // On Windows, file mode checks are not meaningful (NTFS ACLs),
    // but on Unix this verifies 0o600
    if (process.platform !== 'win32') {
      const stats = statSync(join(tempDir, 'token.json'));
      expect(stats.mode & 0o777).toBe(0o600);
    }
  });

  it('loadToken reads and returns TokenCache object', () => {
    const cache: TokenCache = {
      token: 'abc.def.ghi',
      acquiredAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-02T00:00:00Z',
      username: 'testuser',
    };
    saveToken(cache);
    const loaded = loadToken();
    expect(loaded).toEqual(cache);
  });

  it('loadToken returns null when file does not exist', () => {
    const loaded = loadToken();
    expect(loaded).toBeNull();
  });

  it('clearToken deletes token.json', () => {
    const cache: TokenCache = {
      token: 'abc.def.ghi',
      acquiredAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-02T00:00:00Z',
      username: 'testuser',
    };
    saveToken(cache);
    expect(existsSync(join(tempDir, 'token.json'))).toBe(true);
    clearToken();
    expect(existsSync(join(tempDir, 'token.json'))).toBe(false);
  });

  it('clearToken does not throw when file is missing', () => {
    expect(() => clearToken()).not.toThrow();
  });
});
