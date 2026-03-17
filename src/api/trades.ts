import { apiPost } from './client.js';
import type { TradeSearchResponse } from '../types/api.js';

/** Search trade history via POST /api/Trade/search */
export async function searchTrades(
  token: string,
  accountId: number,
  startTimestamp: string,
  endTimestamp?: string,
): Promise<TradeSearchResponse> {
  const body: Record<string, unknown> = { accountId, startTimestamp };
  if (endTimestamp) body.endTimestamp = endTimestamp;
  return apiPost<TradeSearchResponse>('/Trade/search', body, token);
}
