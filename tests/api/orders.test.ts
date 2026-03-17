import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApiPost } = vi.hoisted(() => {
  return { mockApiPost: vi.fn() };
});

vi.mock('../../src/api/client.js', () => ({
  apiPost: mockApiPost,
}));

import { placeOrder, searchOpenOrders, searchOrders, modifyOrder, cancelOrder } from '../../src/api/orders.js';
import type { PlaceOrderRequest, ModifyOrderRequest } from '../../src/types/api.js';
import { OrderSide, OrderType } from '../../src/types/enums.js';

describe('api/orders', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  describe('placeOrder', () => {
    const sampleRequest: PlaceOrderRequest = {
      accountId: 12345,
      contractId: 'CON.F.US.EP.U25',
      type: OrderType.Market,
      side: OrderSide.Bid,
      size: 1,
      limitPrice: null,
      stopPrice: null,
      trailPrice: null,
      customTag: null,
      stopLossBracket: { ticks: 10, type: OrderType.Limit },
      takeProfitBracket: { ticks: 20, type: OrderType.Limit },
    };

    it('calls apiPost with /Order/place endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        orderId: 999,
      });

      await placeOrder('test-token', sampleRequest);

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost.mock.calls[0][0]).toBe('/Order/place');
    });

    it('passes the request body through to apiPost', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        orderId: 999,
      });

      await placeOrder('test-token', sampleRequest);

      const body = mockApiPost.mock.calls[0][1];
      expect(body).toEqual(sampleRequest);
    });

    it('passes the token as the third argument to apiPost', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        orderId: 999,
      });

      await placeOrder('my-jwt-token', sampleRequest);

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt-token');
    });

    it('returns PlaceOrderResponse with orderId field', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        orderId: 42,
      });

      const result = await placeOrder('test-token', sampleRequest);

      expect(result.orderId).toBe(42);
      expect(result.success).toBe(true);
    });

    it('propagates errors from apiPost without wrapping', async () => {
      const error = new Error('API connection failed');
      mockApiPost.mockRejectedValueOnce(error);

      await expect(placeOrder('test-token', sampleRequest)).rejects.toThrow(
        'API connection failed',
      );
    });
  });

  describe('searchOpenOrders', () => {
    it('calls apiPost with /Order/searchOpen endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ orders: [], success: true });

      await searchOpenOrders('test-token', 12345);

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost.mock.calls[0][0]).toBe('/Order/searchOpen');
    });

    it('passes accountId in request body', async () => {
      mockApiPost.mockResolvedValueOnce({ orders: [], success: true });

      await searchOpenOrders('test-token', 12345);

      expect(mockApiPost.mock.calls[0][1]).toEqual({ accountId: 12345 });
    });

    it('passes the token as the third argument', async () => {
      mockApiPost.mockResolvedValueOnce({ orders: [], success: true });

      await searchOpenOrders('my-jwt', 12345);

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt');
    });

    it('returns OrderSearchResponse', async () => {
      const mockOrders = [{ id: 1, accountId: 12345, contractId: 'CON.F.US.EP.U25' }];
      mockApiPost.mockResolvedValueOnce({ orders: mockOrders, success: true });

      const result = await searchOpenOrders('test-token', 12345);

      expect(result.orders).toEqual(mockOrders);
      expect(result.success).toBe(true);
    });

    it('propagates errors from apiPost', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(searchOpenOrders('test-token', 12345)).rejects.toThrow('Network error');
    });
  });

  describe('searchOrders', () => {
    it('calls apiPost with /Order/search endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ orders: [], success: true });

      await searchOrders('test-token', 12345, '2026-03-01T00:00:00Z');

      expect(mockApiPost.mock.calls[0][0]).toBe('/Order/search');
    });

    it('includes accountId and startTimestamp in body', async () => {
      mockApiPost.mockResolvedValueOnce({ orders: [], success: true });

      await searchOrders('test-token', 12345, '2026-03-01T00:00:00Z');

      expect(mockApiPost.mock.calls[0][1]).toEqual({
        accountId: 12345,
        startTimestamp: '2026-03-01T00:00:00Z',
      });
    });

    it('includes endTimestamp when provided', async () => {
      mockApiPost.mockResolvedValueOnce({ orders: [], success: true });

      await searchOrders('test-token', 12345, '2026-03-01T00:00:00Z', '2026-03-07T00:00:00Z');

      expect(mockApiPost.mock.calls[0][1]).toEqual({
        accountId: 12345,
        startTimestamp: '2026-03-01T00:00:00Z',
        endTimestamp: '2026-03-07T00:00:00Z',
      });
    });

    it('omits endTimestamp when not provided', async () => {
      mockApiPost.mockResolvedValueOnce({ orders: [], success: true });

      await searchOrders('test-token', 12345, '2026-03-01T00:00:00Z');

      const body = mockApiPost.mock.calls[0][1];
      expect(body).not.toHaveProperty('endTimestamp');
    });

    it('passes the token as the third argument', async () => {
      mockApiPost.mockResolvedValueOnce({ orders: [], success: true });

      await searchOrders('my-jwt', 12345, '2026-03-01T00:00:00Z');

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt');
    });

    it('propagates errors from apiPost', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Timeout'));

      await expect(searchOrders('test-token', 12345, '2026-03-01T00:00:00Z')).rejects.toThrow('Timeout');
    });
  });

  describe('modifyOrder', () => {
    const sampleModify: ModifyOrderRequest = {
      accountId: 12345,
      orderId: 999,
      limitPrice: 5000,
    };

    it('calls apiPost with /Order/modify endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await modifyOrder('test-token', sampleModify);

      expect(mockApiPost.mock.calls[0][0]).toBe('/Order/modify');
    });

    it('passes the request body through to apiPost', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await modifyOrder('test-token', sampleModify);

      expect(mockApiPost.mock.calls[0][1]).toEqual(sampleModify);
    });

    it('passes the token as the third argument', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await modifyOrder('my-jwt', sampleModify);

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt');
    });

    it('returns SuccessResponse', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      const result = await modifyOrder('test-token', sampleModify);

      expect(result.success).toBe(true);
    });

    it('propagates errors from apiPost', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Forbidden'));

      await expect(modifyOrder('test-token', sampleModify)).rejects.toThrow('Forbidden');
    });
  });

  describe('cancelOrder', () => {
    it('calls apiPost with /Order/cancel endpoint', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await cancelOrder('test-token', 12345, 999);

      expect(mockApiPost.mock.calls[0][0]).toBe('/Order/cancel');
    });

    it('passes accountId and orderId in request body', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await cancelOrder('test-token', 12345, 999);

      expect(mockApiPost.mock.calls[0][1]).toEqual({ accountId: 12345, orderId: 999 });
    });

    it('passes the token as the third argument', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      await cancelOrder('my-jwt', 12345, 999);

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt');
    });

    it('returns SuccessResponse', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      const result = await cancelOrder('test-token', 12345, 999);

      expect(result.success).toBe(true);
    });

    it('propagates errors from apiPost', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Not found'));

      await expect(cancelOrder('test-token', 12345, 999)).rejects.toThrow('Not found');
    });
  });
});
