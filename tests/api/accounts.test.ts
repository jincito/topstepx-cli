import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApiPost } = vi.hoisted(() => {
  return { mockApiPost: vi.fn() };
});

vi.mock('../../src/api/client.js', () => ({
  apiPost: mockApiPost,
}));

import { searchAccounts } from '../../src/api/accounts.js';

describe('api/accounts', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  describe('searchAccounts', () => {
    it('calls apiPost with /Account/search and onlyActiveAccounts: true by default', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        accounts: [{ id: 1, name: 'Test Account', balance: 50000, canTrade: true }],
      });

      const result = await searchAccounts('test-token');

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost).toHaveBeenCalledWith(
        '/Account/search',
        { onlyActiveAccounts: true },
        'test-token',
      );
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].id).toBe(1);
    });

    it('calls apiPost with onlyActiveAccounts: true when explicitly passed true', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        accounts: [],
      });

      await searchAccounts('my-token', true);

      expect(mockApiPost).toHaveBeenCalledWith(
        '/Account/search',
        { onlyActiveAccounts: true },
        'my-token',
      );
    });

    it('calls apiPost with onlyActiveAccounts: false when passed false', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        accounts: [
          { id: 1, name: 'Active', balance: 50000, canTrade: true },
          { id: 2, name: 'Inactive', balance: 0, canTrade: false },
        ],
      });

      const result = await searchAccounts('my-token', false);

      expect(mockApiPost).toHaveBeenCalledWith(
        '/Account/search',
        { onlyActiveAccounts: false },
        'my-token',
      );
      expect(result.accounts).toHaveLength(2);
    });

    it('propagates errors from apiPost without wrapping', async () => {
      const error = new Error('API connection failed');
      mockApiPost.mockRejectedValueOnce(error);

      await expect(searchAccounts('test-token')).rejects.toThrow('API connection failed');
    });
  });
});
