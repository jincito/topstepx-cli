import { RateLimiter, RATE_LIMITS } from './rate-limiter.js';
import { ApiError } from '../errors/api-error.js';
import { AuthError } from '../errors/auth-error.js';
import { NetworkError } from '../errors/network-error.js';
import { verbose } from '../output/index.js';
import { theme } from '../output/index.js';

/**
 * Base URL for the TopStepX REST API.
 * Auth endpoints (login, validate) remain in src/auth/client.ts.
 * This client handles all data/trading endpoints.
 */
export const API_BASE_URL = 'https://api.topstepx.com/api';

/** Module-level rate limiter instances (persist across calls). */
const generalLimiter = new RateLimiter('general', RATE_LIMITS.GENERAL);
const historyLimiter = new RateLimiter('history', RATE_LIMITS.HISTORY);

/**
 * Select the appropriate rate limiter based on the endpoint path.
 * History endpoints have stricter limits (50/30s vs 200/60s).
 */
function getLimiter(endpoint: string): RateLimiter {
  return endpoint.includes('/History/') ? historyLimiter : generalLimiter;
}

/**
 * Make an authenticated POST request to the TopStepX API.
 *
 * Provides three safety guarantees:
 * 1. Rate limiting via dual-bucket sliding window (SAF-03)
 * 2. Response envelope validation (success:true/false)
 * 3. HTTP status-aware error handling (401 re-auth, 429 backoff)
 *
 * @param endpoint - API path starting with / (e.g. '/Account/search')
 * @param body - Request body as a plain object
 * @param token - JWT authentication token
 * @returns Parsed response data cast to type T
 * @throws {AuthError} On HTTP 401 (session expired)
 * @throws {ApiError} On success:false or HTTP 429 after retry
 * @throws {NetworkError} On connection failure
 */
export async function apiPost<T>(
  endpoint: string,
  body: Record<string, unknown>,
  token: string,
): Promise<T> {
  const limiter = getLimiter(endpoint);

  // SAF-03: Wait for a rate limit slot before sending
  const waitedMs = await limiter.waitForSlot();
  if (waitedMs > 0) {
    console.error(
      theme.warning(`Rate limited: waited ${waitedMs}ms before request`),
    );
  }

  const url = `${API_BASE_URL}${endpoint}`;

  verbose('api', { method: 'POST', url, body });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new NetworkError('Failed to connect to TopStepX API', {
      url,
      cause,
    });
  }

  // HTTP 401: Session expired
  if (response.status === 401) {
    throw new AuthError('Session expired. Run: topstep login', { url });
  }

  // HTTP 429: Rate limited by server -- retry once with backoff
  if (response.status === 429) {
    const retryAfter =
      parseInt(response.headers.get('Retry-After') ?? '', 10) || 5;

    console.error(
      theme.warning(
        `Server rate limit hit. Retrying in ${retryAfter}s...`,
      ),
    );

    await new Promise((resolve) =>
      setTimeout(resolve, retryAfter * 1000),
    );

    // Retry once
    let retryResponse: Response;
    try {
      retryResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new NetworkError('Failed to connect to TopStepX API', {
        url,
        cause,
      });
    }

    if (retryResponse.status === 429) {
      throw new ApiError(
        'Rate limited after retry. Try again later.',
        429,
        { url },
      );
    }

    const retryData = (await retryResponse.json()) as {
      success: boolean;
      errorCode?: number;
      errorMessage?: string | null;
      [key: string]: unknown;
    };

    verbose('api', { status: retryResponse.status, data: retryData });

    if (!retryData.success) {
      throw new ApiError(
        retryData.errorMessage ?? 'API request failed',
        retryData.errorCode ?? 0,
        { url, endpoint },
      );
    }

    return retryData as unknown as T;
  }

  // Parse response envelope
  const data = (await response.json()) as {
    success: boolean;
    errorCode?: number;
    errorMessage?: string | null;
    [key: string]: unknown;
  };

  verbose('api', { status: response.status, data });

  // Envelope check: success:false means API-level error
  if (!data.success) {
    throw new ApiError(
      data.errorMessage ?? 'API request failed',
      data.errorCode ?? 0,
      { url, endpoint },
    );
  }

  return data as unknown as T;
}
