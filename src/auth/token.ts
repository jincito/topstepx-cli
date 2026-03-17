import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir, ensureConfigDir } from '../config/paths.js';
import { AuthError } from '../errors/index.js';

/** Decoded JWT payload with standard and custom claims */
export interface JwtPayload {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/** Persisted token data written to disk */
export interface TokenCache {
  token: string;
  acquiredAt: string;
  expiresAt: string;
  username: string;
}

const TOKEN_FILE = 'token.json';

/**
 * Decode the payload section of a JWT without verifying the signature.
 * Only base64url-decodes the middle segment and parses as JSON.
 */
export function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthError('Invalid JWT format', { token: token.substring(0, 20) + '...' });
  }
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload) as JwtPayload;
}

/**
 * Check whether a JWT token is expiring soon or already expired.
 * Returns true when:
 * - token age (now - iat) >= thresholdHours
 * - now >= exp (token already expired)
 * - exp claim is missing
 */
export function isTokenExpiringSoon(token: string, thresholdHours: number = 23): boolean {
  const payload = decodeJwtPayload(token);

  if (!payload.exp) {
    return true; // No exp claim = treat as expired
  }

  const nowMs = Date.now();
  const expiresAtMs = payload.exp * 1000;

  // Already expired
  if (nowMs >= expiresAtMs) {
    return true;
  }

  // Check age against threshold
  if (payload.iat) {
    const acquiredAtMs = payload.iat * 1000;
    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    if ((nowMs - acquiredAtMs) >= thresholdMs) {
      return true;
    }
  }

  return false;
}

/** Returns the full path to the token cache file */
export function getTokenPath(): string {
  return join(getConfigDir(), TOKEN_FILE);
}

/** Save token cache to disk with restricted file permissions */
export function saveToken(cache: TokenCache): void {
  ensureConfigDir();
  writeFileSync(getTokenPath(), JSON.stringify(cache, null, 2), { mode: 0o600 });
}

/** Load token cache from disk. Returns null if file does not exist or is invalid. */
export function loadToken(): TokenCache | null {
  try {
    const raw = readFileSync(getTokenPath(), 'utf-8');
    return JSON.parse(raw) as TokenCache;
  } catch {
    return null;
  }
}

/** Delete token cache file. Does not throw if file is missing. */
export function clearToken(): void {
  try {
    unlinkSync(getTokenPath());
  } catch {
    // Ignore - file may not exist
  }
}
