import { apiPost } from './client.js';
import type { ContractSearchResponse, ContractByIdResponse } from '../types/api.js';

/**
 * Search for contracts by text query.
 *
 * @param token - JWT authentication token
 * @param searchText - Search term (e.g. "ES", "NQ", "crude")
 * @returns Typed contract search response with contracts array
 */
export async function searchContracts(
  token: string,
  searchText: string,
): Promise<ContractSearchResponse> {
  return apiPost<ContractSearchResponse>(
    '/Contract/search',
    { searchText },
    token,
  );
}

/**
 * Get all available (active) contracts.
 *
 * @param token - JWT authentication token
 * @returns Typed contract search response with all available contracts
 */
export async function getAvailableContracts(
  token: string,
): Promise<ContractSearchResponse> {
  return apiPost<ContractSearchResponse>(
    '/Contract/available',
    {},
    token,
  );
}

/**
 * Get a single contract by its full contract ID.
 *
 * @param token - JWT authentication token
 * @param contractId - Full contract ID (e.g. "CON.F.US.EP.U25")
 * @returns Typed response with a single contract object
 */
export async function getContractById(
  token: string,
  contractId: string,
): Promise<ContractByIdResponse> {
  return apiPost<ContractByIdResponse>(
    '/Contract/searchById',
    { contractId },
    token,
  );
}
