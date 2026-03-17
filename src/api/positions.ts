import { apiPost } from './client.js';
import type { PositionSearchResponse, SuccessResponse } from '../types/api.js';

/** Search open positions via POST /api/Position/searchOpen */
export async function searchOpenPositions(
  token: string,
  accountId: number,
): Promise<PositionSearchResponse> {
  return apiPost<PositionSearchResponse>(
    '/Position/searchOpen',
    { accountId } as Record<string, unknown>,
    token,
  );
}

/** Close an entire position via POST /api/Position/closeContract */
export async function closePosition(
  token: string,
  accountId: number,
  contractId: string,
): Promise<SuccessResponse> {
  return apiPost<SuccessResponse>(
    '/Position/closeContract',
    { accountId, contractId } as Record<string, unknown>,
    token,
  );
}

/** Partially close a position via POST /api/Position/partialCloseContract */
export async function partialClosePosition(
  token: string,
  accountId: number,
  contractId: string,
  size: number,
): Promise<SuccessResponse> {
  return apiPost<SuccessResponse>(
    '/Position/partialCloseContract',
    { accountId, contractId, size } as Record<string, unknown>,
    token,
  );
}
