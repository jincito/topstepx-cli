import { loadToken, saveToken, isTokenExpiringSoon, decodeJwtPayload } from './token.js';
import { refreshToken } from './client.js';
import { AuthError } from '../errors/index.js';
import { verbose } from '../output/index.js';

/** Commands that do not require authentication */
const UNAUTHENTICATED_COMMANDS = new Set(['login', 'logout', 'status', 'help', 'version']);

/**
 * Pre-action hook that ensures a valid auth token exists before running
 * authenticated commands. Skips auth for login, logout, status, help, and version.
 *
 * When the cached token is approaching expiry (>23 hours old), silently
 * refreshes it and updates the cache on disk.
 *
 * @param command - Commander Command (or any object with .name() method)
 * @returns The current valid token, or '' for unauthenticated commands
 * @throws AuthError if not authenticated or token refresh fails
 */
export async function ensureAuth(command: { name(): string }): Promise<string> {
  const commandName = command.name();

  if (UNAUTHENTICATED_COMMANDS.has(commandName)) {
    return '';
  }

  const cached = loadToken();

  if (!cached) {
    throw new AuthError('Not authenticated. Run: topstep login');
  }

  if (isTokenExpiringSoon(cached.token)) {
    verbose('auth', 'Token approaching expiry, refreshing...');
    const newToken = await refreshToken(cached.token);
    const payload = decodeJwtPayload(newToken);

    saveToken({
      ...cached,
      token: newToken,
      acquiredAt: new Date().toISOString(),
      expiresAt: payload.exp
        ? new Date(payload.exp * 1000).toISOString()
        : cached.expiresAt,
    });

    return newToken;
  }

  return cached.token;
}
