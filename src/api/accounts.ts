import { apiPost } from './client.js';
import type { AccountSearchResponse } from '../types/api.js';

/**
 * Search for trading accounts.
 *
 * @param token - JWT authentication token
 * @param onlyActive - When true, returns only accounts with canTrade:true (default: true)
 * @returns Typed account search response with accounts array
 */
export async function searchAccounts(
  token: string,
  onlyActive: boolean = true,
): Promise<AccountSearchResponse> {
  return apiPost<AccountSearchResponse>(
    '/Account/search',
    { onlyActiveAccounts: onlyActive },
    token,
  );
}
