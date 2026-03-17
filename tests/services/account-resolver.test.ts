import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSearchAccounts } = vi.hoisted(() => {
  return { mockSearchAccounts: vi.fn() };
});

vi.mock('../../src/api/accounts.js', () => ({
  searchAccounts: mockSearchAccounts,
}));

import { resolveAccountId } from '../../src/services/account-resolver.js';
import { ValidationError } from '../../src/errors/validation-error.js';
import { ApiError } from '../../src/errors/api-error.js';

describe('services/account-resolver', () => {
  beforeEach(() => {
    mockSearchAccounts.mockReset();
  });

  describe('resolveAccountId', () => {
    it('returns parsed integer when --account flag provides a valid number', async () => {
      const result = await resolveAccountId({ account: '12345' }, 'test-token');

      expect(result).toBe(12345);
      expect(mockSearchAccounts).not.toHaveBeenCalled();
    });

    it('throws ValidationError when --account flag is non-numeric', async () => {
      await expect(
        resolveAccountId({ account: 'abc' }, 'test-token'),
      ).rejects.toThrow(ValidationError);

      await expect(
        resolveAccountId({ account: 'abc' }, 'test-token'),
      ).rejects.toThrow('Account ID must be a number');
    });

    it('calls searchAccounts and returns first account id when no flag provided', async () => {
      mockSearchAccounts.mockResolvedValueOnce({
        success: true,
        accounts: [
          { id: 99001, name: 'Main Account', balance: 50000, canTrade: true },
          { id: 99002, name: 'Second Account', balance: 25000, canTrade: true },
        ],
      });

      const result = await resolveAccountId({}, 'my-token');

      expect(result).toBe(99001);
      expect(mockSearchAccounts).toHaveBeenCalledWith('my-token', true);
    });

    it('throws ApiError when no active accounts exist', async () => {
      mockSearchAccounts.mockResolvedValueOnce({
        success: true,
        accounts: [],
      });

      await expect(
        resolveAccountId({}, 'test-token'),
      ).rejects.toThrow(ApiError);

      mockSearchAccounts.mockResolvedValueOnce({
        success: true,
        accounts: [],
      });

      await expect(
        resolveAccountId({}, 'test-token'),
      ).rejects.toThrow('No active accounts found');
    });

    it('handles undefined account property same as missing flag', async () => {
      mockSearchAccounts.mockResolvedValueOnce({
        success: true,
        accounts: [
          { id: 55555, name: 'Default', balance: 10000, canTrade: true },
        ],
      });

      const result = await resolveAccountId({ account: undefined }, 'test-token');

      expect(result).toBe(55555);
    });
  });
});
