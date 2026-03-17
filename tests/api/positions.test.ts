import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApiPost } = vi.hoisted(() => {
  return { mockApiPost: vi.fn() };
});

vi.mock('../../src/api/client.js', () => ({
  apiPost: mockApiPost,
}));

import { searchOpenPositions, closePosition, partialClosePosition } from '../../src/api/positions.js';

describe('api/positions', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  describe('searchOpenPositions', () => {
    it('calls apiPost with /Position/searchOpen endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ positions: [], success: true });

      await searchOpenPositions('test-token', 12345);

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost.mock.calls[0][0]).toBe('/Position/searchOpen');
    });

    it('passes accountId in request body', async () => {
      mockApiPost.mockResolvedValueOnce({ positions: [], success: true });

      await searchOpenPositions('test-token', 12345);

      expect(mockApiPost.mock.calls[0][1]).toEqual({ accountId: 12345 });
    });

    it('passes the token as the third argument', async () => {
      mockApiPost.mockResolvedValueOnce({ positions: [], success: true });

      await searchOpenPositions('my-jwt', 12345);

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt');
    });

    it('returns PositionSearchResponse', async () => {
      const mockPositions = [{ id: 1, accountId: 12345, contractId: 'CON.F.US.EP.U25', type: 1, size: 2, averagePrice: 5000 }];
      mockApiPost.mockResolvedValueOnce({ positions: mockPositions, success: true });

      const result = await searchOpenPositions('test-token', 12345);

      expect(result.positions).toEqual(mockPositions);
      expect(result.success).toBe(true);
    });

    it('propagates errors from apiPost', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(searchOpenPositions('test-token', 12345)).rejects.toThrow('Network error');
    });
  });

  describe('closePosition', () => {
    it('calls apiPost with /Position/closeContract endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await closePosition('test-token', 12345, 'CON.F.US.EP.U25');

      expect(mockApiPost.mock.calls[0][0]).toBe('/Position/closeContract');
    });

    it('passes accountId and contractId in request body', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await closePosition('test-token', 12345, 'CON.F.US.EP.U25');

      expect(mockApiPost.mock.calls[0][1]).toEqual({
        accountId: 12345,
        contractId: 'CON.F.US.EP.U25',
      });
    });

    it('passes the token as the third argument', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await closePosition('my-jwt', 12345, 'CON.F.US.EP.U25');

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt');
    });

    it('returns SuccessResponse', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      const result = await closePosition('test-token', 12345, 'CON.F.US.EP.U25');

      expect(result.success).toBe(true);
    });

    it('propagates errors from apiPost', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Server error'));

      await expect(closePosition('test-token', 12345, 'CON.F.US.EP.U25')).rejects.toThrow('Server error');
    });
  });

  describe('partialClosePosition', () => {
    it('calls apiPost with /Position/partialCloseContract endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await partialClosePosition('test-token', 12345, 'CON.F.US.EP.U25', 2);

      expect(mockApiPost.mock.calls[0][0]).toBe('/Position/partialCloseContract');
    });

    it('passes accountId, contractId, and size in request body', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await partialClosePosition('test-token', 12345, 'CON.F.US.EP.U25', 3);

      expect(mockApiPost.mock.calls[0][1]).toEqual({
        accountId: 12345,
        contractId: 'CON.F.US.EP.U25',
        size: 3,
      });
    });

    it('passes the token as the third argument', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await partialClosePosition('my-jwt', 12345, 'CON.F.US.EP.U25', 1);

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt');
    });

    it('returns SuccessResponse', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      const result = await partialClosePosition('test-token', 12345, 'CON.F.US.EP.U25', 1);

      expect(result.success).toBe(true);
    });

    it('propagates errors from apiPost', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Bad request'));

      await expect(partialClosePosition('test-token', 12345, 'CON.F.US.EP.U25', 1)).rejects.toThrow('Bad request');
    });
  });
});
