import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock config/paths
vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: vi.fn(() => '/mock/.config/topstepx'),
  ensureConfigDir: vi.fn(() => '/mock/.config/topstepx'),
}));

import { readFileSync, writeFileSync } from 'node:fs';
import { RateLimiter, RATE_LIMITS } from '../../src/api/rate-limiter.js';

describe('RateLimiter', () => {
  const mockedReadFileSync = vi.mocked(readFileSync);
  const mockedWriteFileSync = vi.mocked(writeFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing state file
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 0 (no wait) when bucket is empty', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);

    const limiter = new RateLimiter('general', RATE_LIMITS.GENERAL);
    const waited = await limiter.waitForSlot();

    expect(waited).toBe(0);
  });

  it('returns 0 for requests under the limit', async () => {
    const now = 1000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    // Pre-fill with 5 timestamps (well under 200 limit)
    const timestamps = Array.from({ length: 5 }, (_, i) => now - i * 100);
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ general: timestamps }),
    );

    const limiter = new RateLimiter('general', RATE_LIMITS.GENERAL);
    const waited = await limiter.waitForSlot();

    expect(waited).toBe(0);
  });

  it('waits and returns positive ms when bucket is full', async () => {
    const now = 1000000;
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    // Fill bucket to capacity (200 requests in 60s window)
    const timestamps = Array.from(
      { length: 200 },
      (_, i) => now - i * 100,
    );
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ general: timestamps }),
    );

    // After waiting, Date.now returns a future value
    let callCount = 0;
    dateNowSpy.mockImplementation(() => {
      callCount++;
      // First calls: during loadState/prune, return 'now'
      // After setTimeout resolves: return future time
      return callCount <= 210 ? now : now + 50000;
    });

    const limiter = new RateLimiter('general', RATE_LIMITS.GENERAL);

    // Mock setTimeout to resolve immediately for test speed
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const waitPromise = limiter.waitForSlot();
    vi.advanceTimersByTime(60000);
    const waited = await waitPromise;
    vi.useRealTimers();

    expect(waited).toBeGreaterThan(0);
  });

  it('prunes timestamps older than window', async () => {
    const now = 1000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    // Create timestamps from 2 minutes ago (should be pruned for 60s window)
    const oldTimestamps = [now - 120000, now - 130000, now - 140000];
    const recentTimestamp = [now - 1000];
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ general: [...oldTimestamps, ...recentTimestamp] }),
    );

    const limiter = new RateLimiter('general', RATE_LIMITS.GENERAL);
    await limiter.waitForSlot();

    // Verify writeFileSync was called and only recent timestamps + new one survive
    expect(mockedWriteFileSync).toHaveBeenCalled();
    const writtenData = JSON.parse(
      mockedWriteFileSync.mock.calls[0][1] as string,
    );
    // Only recentTimestamp + the new timestamp should remain (2 total), not the old ones
    expect(writtenData.general.length).toBe(2);
    expect(writtenData.general).not.toContain(oldTimestamps[0]);
  });

  it('persists state to JSON file and restores on new instance', async () => {
    const now = 1000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    // First limiter instance saves timestamps
    const limiter1 = new RateLimiter('general', RATE_LIMITS.GENERAL);
    await limiter1.waitForSlot();

    // Capture what was written
    expect(mockedWriteFileSync).toHaveBeenCalled();
    const savedState = mockedWriteFileSync.mock.calls[0][1] as string;

    // Second limiter instance reads the saved state
    mockedReadFileSync.mockReturnValue(savedState);
    const limiter2 = new RateLimiter('general', RATE_LIMITS.GENERAL);
    await limiter2.waitForSlot();

    // Second call should also write, now with 2 timestamps
    const lastCallData = JSON.parse(
      mockedWriteFileSync.mock.calls[mockedWriteFileSync.mock.calls.length - 1][1] as string,
    );
    expect(lastCallData.general.length).toBe(2);
  });

  it('handles corrupted state file gracefully (returns empty state)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);

    // Corrupt JSON data
    mockedReadFileSync.mockReturnValue('not valid json {{{');

    const limiter = new RateLimiter('general', RATE_LIMITS.GENERAL);
    // Should not throw
    const waited = await limiter.waitForSlot();

    expect(waited).toBe(0);
  });

  it('handles missing state file gracefully (returns empty state)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);

    // File not found (already the default mock behavior)
    const limiter = new RateLimiter('general', RATE_LIMITS.GENERAL);
    const waited = await limiter.waitForSlot();

    expect(waited).toBe(0);
  });

  it('prunes ALL buckets on every read, not just the active bucket', async () => {
    const now = 1000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    // State with old timestamps in an inactive bucket ('history')
    const state = {
      general: [now - 1000], // recent -- should survive
      history: [now - 120000, now - 130000], // old for 30s window -- should be pruned
    };
    mockedReadFileSync.mockReturnValue(JSON.stringify(state));

    // Use 'general' limiter - but 'history' bucket should also be pruned
    const limiter = new RateLimiter('general', RATE_LIMITS.GENERAL);
    await limiter.waitForSlot();

    const writtenData = JSON.parse(
      mockedWriteFileSync.mock.calls[0][1] as string,
    );
    // History bucket entries were older than 30s window; however the limiter
    // only knows its own bucket config. Pruning all buckets means removing
    // entries older than the ACTIVE limiter's window from all buckets.
    // The history entries (120s and 130s old) are also > 60s, so pruned under general's window.
    expect(writtenData.history.length).toBe(0);
  });

  describe('RATE_LIMITS constants', () => {
    it('has correct GENERAL config', () => {
      expect(RATE_LIMITS.GENERAL).toEqual({
        requests: 200,
        windowMs: 60_000,
      });
    });

    it('has correct HISTORY config', () => {
      expect(RATE_LIMITS.HISTORY).toEqual({
        requests: 50,
        windowMs: 30_000,
      });
    });
  });
});
