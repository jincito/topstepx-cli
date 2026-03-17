import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApiPost } = vi.hoisted(() => {
  return { mockApiPost: vi.fn() };
});

vi.mock('../../src/api/client.js', () => ({
  apiPost: mockApiPost,
}));

import { searchTrades } from '../../src/api/trades.js';

describe('api/trades', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  describe('searchTrades', () => {
    it('calls apiPost with /Trade/search endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ trades: [], success: true });

      await searchTrades('test-token', 12345, '2026-03-01T00:00:00Z');

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost.mock.calls[0][0]).toBe('/Trade/search');
    });

    it('includes accountId and startTimestamp in body', async () => {
      mockApiPost.mockResolvedValueOnce({ trades: [], success: true });

      await searchTrades('test-token', 12345, '2026-03-01T00:00:00Z');

      expect(mockApiPost.mock.calls[0][1]).toEqual({
        accountId: 12345,
        startTimestamp: '2026-03-01T00:00:00Z',
      });
    });

    it('includes endTimestamp when provided', async () => {
      mockApiPost.mockResolvedValueOnce({ trades: [], success: true });

      await searchTrades('test-token', 12345, '2026-03-01T00:00:00Z', '2026-03-07T00:00:00Z');

      expect(mockApiPost.mock.calls[0][1]).toEqual({
        accountId: 12345,
        startTimestamp: '2026-03-01T00:00:00Z',
        endTimestamp: '2026-03-07T00:00:00Z',
      });
    });

    it('omits endTimestamp when not provided', async () => {
      mockApiPost.mockResolvedValueOnce({ trades: [], success: true });

      await searchTrades('test-token', 12345, '2026-03-01T00:00:00Z');

      const body = mockApiPost.mock.calls[0][1];
      expect(body).not.toHaveProperty('endTimestamp');
    });

    it('passes the token as the third argument', async () => {
      mockApiPost.mockResolvedValueOnce({ trades: [], success: true });

      await searchTrades('my-jwt', 12345, '2026-03-01T00:00:00Z');

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt');
    });

    it('returns TradeSearchResponse', async () => {
      const mockTrades = [{ id: 1, accountId: 12345, price: 5000, size: 1 }];
      mockApiPost.mockResolvedValueOnce({ trades: mockTrades, success: true });

      const result = await searchTrades('test-token', 12345, '2026-03-01T00:00:00Z');

      expect(result.trades).toEqual(mockTrades);
      expect(result.success).toBe(true);
    });

    it('propagates errors from apiPost', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Rate limited'));

      await expect(searchTrades('test-token', 12345, '2026-03-01T00:00:00Z')).rejects.toThrow('Rate limited');
    });
  });
});
