import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApiPost } = vi.hoisted(() => {
  return { mockApiPost: vi.fn() };
});

vi.mock('../../src/api/client.js', () => ({
  apiPost: mockApiPost,
}));

import {
  searchContracts,
  getAvailableContracts,
  getContractById,
} from '../../src/api/contracts.js';

describe('api/contracts', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  describe('searchContracts', () => {
    it('calls apiPost with /Contract/search and searchText body', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        contracts: [
          {
            id: 'CON.F.US.EP.U25',
            name: 'ESU5',
            description: 'E-mini S&P 500: September 2025',
            tickSize: 0.25,
            tickValue: 12.5,
            activeContract: true,
            symbolId: 'F.US.EP',
          },
        ],
      });

      const result = await searchContracts('test-token', 'ES');

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost).toHaveBeenCalledWith(
        '/Contract/search',
        { searchText: 'ES' },
        'test-token',
      );
      expect(result.contracts).toHaveLength(1);
      expect(result.contracts[0].id).toBe('CON.F.US.EP.U25');
    });

    it('propagates errors from apiPost without wrapping', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(searchContracts('test-token', 'ES')).rejects.toThrow('Network error');
    });
  });

  describe('getAvailableContracts', () => {
    it('calls apiPost with /Contract/available and empty body', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        contracts: [
          {
            id: 'CON.F.US.EP.U25',
            name: 'ESU5',
            description: 'E-mini S&P 500',
            tickSize: 0.25,
            tickValue: 12.5,
            activeContract: true,
            symbolId: 'F.US.EP',
          },
          {
            id: 'CON.F.US.ENQ.U25',
            name: 'NQU5',
            description: 'E-mini NASDAQ-100',
            tickSize: 0.25,
            tickValue: 5,
            activeContract: true,
            symbolId: 'F.US.ENQ',
          },
        ],
      });

      const result = await getAvailableContracts('my-token');

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost).toHaveBeenCalledWith(
        '/Contract/available',
        {},
        'my-token',
      );
      expect(result.contracts).toHaveLength(2);
    });

    it('propagates errors from apiPost without wrapping', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Timeout'));

      await expect(getAvailableContracts('test-token')).rejects.toThrow('Timeout');
    });
  });

  describe('getContractById', () => {
    it('calls apiPost with /Contract/searchById and contractId body', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        contract: {
          id: 'CON.F.US.EP.U25',
          name: 'ESU5',
          description: 'E-mini S&P 500: September 2025',
          tickSize: 0.25,
          tickValue: 12.5,
          activeContract: true,
          symbolId: 'F.US.EP',
        },
      });

      const result = await getContractById('test-token', 'CON.F.US.EP.U25');

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost).toHaveBeenCalledWith(
        '/Contract/searchById',
        { contractId: 'CON.F.US.EP.U25' },
        'test-token',
      );
      expect(result.contract.id).toBe('CON.F.US.EP.U25');
      expect(result.contract.name).toBe('ESU5');
    });

    it('propagates errors from apiPost without wrapping', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Server error'));

      await expect(
        getContractById('test-token', 'CON.F.US.EP.U25'),
      ).rejects.toThrow('Server error');
    });
  });
});
