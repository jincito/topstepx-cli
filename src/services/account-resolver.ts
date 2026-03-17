import { searchAccounts } from '../api/accounts.js';
import { ValidationError } from '../errors/validation-error.js';
import { ApiError } from '../errors/api-error.js';

/**
 * Resolve an account ID from the --account CLI flag or auto-default to first active account.
 *
 * @param globals - Global CLI options (may contain account as string)
 * @param token - JWT authentication token for API calls
 * @returns Numeric account ID
 * @throws {ValidationError} When --account flag value is not a valid number
 * @throws {ApiError} When no active accounts are found (auto-default path)
 */
export async function resolveAccountId(
  globals: { account?: string },
  token: string,
): Promise<number> {
  if (globals.account) {
    const id = parseInt(globals.account, 10);
    if (isNaN(id)) {
      throw new ValidationError('Account ID must be a number', { field: 'account' });
    }
    return id;
  }

  // Auto-default: first active account
  const { accounts } = await searchAccounts(token, true);
  if (!accounts || accounts.length === 0) {
    throw new ApiError('No active accounts found', 0);
  }
  return accounts[0].id;
}
