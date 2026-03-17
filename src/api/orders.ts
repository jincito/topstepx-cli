import { apiPost } from './client.js';
import type {
  PlaceOrderRequest,
  PlaceOrderResponse,
  OrderSearchResponse,
  ModifyOrderRequest,
  SuccessResponse,
} from '../types/api.js';

/**
 * Place an order via POST /api/Order/place.
 *
 * Thin wrapper following the established delegation pattern:
 * no extra try/catch -- errors propagate naturally from apiPost.
 */
export async function placeOrder(
  token: string,
  request: PlaceOrderRequest,
): Promise<PlaceOrderResponse> {
  return apiPost<PlaceOrderResponse>(
    '/Order/place',
    request as unknown as Record<string, unknown>,
    token,
  );
}

/** Search open/working orders via POST /api/Order/searchOpen */
export async function searchOpenOrders(
  token: string,
  accountId: number,
): Promise<OrderSearchResponse> {
  return apiPost<OrderSearchResponse>(
    '/Order/searchOpen',
    { accountId } as Record<string, unknown>,
    token,
  );
}

/** Search all orders (with date range) via POST /api/Order/search */
export async function searchOrders(
  token: string,
  accountId: number,
  startTimestamp: string,
  endTimestamp?: string,
): Promise<OrderSearchResponse> {
  const body: Record<string, unknown> = { accountId, startTimestamp };
  if (endTimestamp) body.endTimestamp = endTimestamp;
  return apiPost<OrderSearchResponse>('/Order/search', body, token);
}

/** Modify a working order via POST /api/Order/modify */
export async function modifyOrder(
  token: string,
  request: ModifyOrderRequest,
): Promise<SuccessResponse> {
  return apiPost<SuccessResponse>(
    '/Order/modify',
    request as unknown as Record<string, unknown>,
    token,
  );
}

/** Cancel a single order via POST /api/Order/cancel */
export async function cancelOrder(
  token: string,
  accountId: number,
  orderId: number,
): Promise<SuccessResponse> {
  return apiPost<SuccessResponse>(
    '/Order/cancel',
    { accountId, orderId } as Record<string, unknown>,
    token,
  );
}
