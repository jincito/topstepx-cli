import { AuthError } from '../errors/index.js';
import { NetworkError } from '../errors/index.js';
import { verbose } from '../output/index.js';

/** Base URL for the TopStepX API. */
export const API_BASE_URL = 'https://api.topstepx.com/api';

/** Shape of the /Auth/loginKey response. */
export interface LoginResponse {
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
  token: string;
}

/** Shape of the /Auth/validate response. */
export interface ValidateResponse {
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
  newToken: string;
}

/**
 * Authenticate with the TopStepX API using username and API key.
 * Returns a JWT token string on success.
 */
export async function login(username: string, apiKey: string): Promise<string> {
  verbose('auth', 'Logging in as ' + username);

  const url = `${API_BASE_URL}/Auth/loginKey`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ userName: username, apiKey }),
    });
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new NetworkError('Failed to connect to TopStepX API', { url, cause });
  }

  const data = (await response.json()) as LoginResponse;

  if (!data.success) {
    throw new AuthError(
      `Login failed: ${data.errorMessage ?? 'Unknown error'}`,
      { errorCode: data.errorCode },
    );
  }

  verbose('auth', 'Login successful');
  return data.token;
}

/**
 * Validate and refresh an existing JWT token.
 * Returns a fresh token string on success.
 */
export async function refreshToken(currentToken: string): Promise<string> {
  verbose('auth', 'Refreshing token...');

  const url = `${API_BASE_URL}/Auth/validate`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
    });
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new NetworkError('Failed to connect to TopStepX API', { url, cause });
  }

  const data = (await response.json()) as ValidateResponse;

  if (!data.success) {
    throw new AuthError('Token refresh failed. Run: topstep login', {
      errorCode: data.errorCode,
    });
  }

  verbose('auth', 'Token refreshed successfully');
  return data.newToken;
}
