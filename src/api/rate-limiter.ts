import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir, ensureConfigDir } from '../config/paths.js';

/**
 * Rate limit configuration constants per endpoint category.
 * SAF-03: History endpoints have stricter limits than general endpoints.
 */
export const RATE_LIMITS = {
  GENERAL: { requests: 200, windowMs: 60_000 },
  HISTORY: { requests: 50, windowMs: 30_000 },
} as const;

/** Rate limit bucket configuration. */
export interface RateLimitConfig {
  readonly requests: number;
  readonly windowMs: number;
}

/** Shape of the persisted rate limit state file. */
type RateLimitState = { [bucket: string]: number[] };

/** Path to the rate limit state file. */
const STATE_FILE = 'rate-limits.json';

/**
 * Sliding-window rate limiter with file-persisted state.
 *
 * Each instance tracks a named bucket (e.g. 'general', 'history')
 * against a configured request limit and time window. State persists
 * to ~/.config/topstepx/rate-limits.json so limits survive across
 * CLI invocations.
 */
export class RateLimiter {
  private readonly bucket: string;
  private readonly config: RateLimitConfig;

  constructor(bucket: string, config: RateLimitConfig) {
    this.bucket = bucket;
    this.config = config;
  }

  /**
   * Wait for a rate limit slot to become available.
   * Returns 0 if a slot is immediately available, or the number of
   * milliseconds waited if throttling was required.
   */
  async waitForSlot(): Promise<number> {
    const state = this.loadState();
    const now = Date.now();

    // Prune ALL buckets (not just ours) to prevent unbounded file growth
    for (const key of Object.keys(state)) {
      state[key] = state[key].filter((t) => now - t < this.config.windowMs);
    }

    const bucketTimestamps = state[this.bucket] ?? [];
    let waited = 0;

    if (bucketTimestamps.length >= this.config.requests) {
      // Bucket is full -- wait until the oldest entry expires
      const oldest = bucketTimestamps[0];
      const waitMs = this.config.windowMs - (now - oldest) + 100; // +100ms buffer

      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        waited = waitMs;
      }
    }

    // Record the new timestamp
    bucketTimestamps.push(Date.now());
    state[this.bucket] = bucketTimestamps;

    this.saveState(state);
    return waited;
  }

  /**
   * Load the rate limit state from the JSON file.
   * Returns empty state on any error (missing file, corruption, parse error).
   */
  private loadState(): RateLimitState {
    try {
      const filePath = join(getConfigDir(), STATE_FILE);
      const raw = readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as RateLimitState;
    } catch {
      return {};
    }
  }

  /**
   * Save the rate limit state to the JSON file.
   * Creates the config directory if it does not exist.
   */
  private saveState(state: RateLimitState): void {
    ensureConfigDir();
    const filePath = join(getConfigDir(), STATE_FILE);
    writeFileSync(filePath, JSON.stringify(state), 'utf-8');
  }
}
