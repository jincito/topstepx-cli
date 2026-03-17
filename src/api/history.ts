import { apiPost } from './client.js';
import { BarTimeUnit } from '../types/enums.js';
import { ValidationError } from '../errors/validation-error.js';
import type { BarResponse } from '../types/api.js';

// ─── Interval Parsing ──────────────────────────────────────────────
// Maps user-friendly interval strings to BarTimeUnit named constants.
// SAF-01: All values use named constants, never bare integers.

/** Static map of supported interval strings to unit/unitNumber pairs */
const INTERVAL_MAP: Record<string, { unit: number; unitNumber: number }> = {
  '1s':  { unit: BarTimeUnit.Second, unitNumber: 1 },
  '5s':  { unit: BarTimeUnit.Second, unitNumber: 5 },
  '1m':  { unit: BarTimeUnit.Minute, unitNumber: 1 },
  '5m':  { unit: BarTimeUnit.Minute, unitNumber: 5 },
  '15m': { unit: BarTimeUnit.Minute, unitNumber: 15 },
  '30m': { unit: BarTimeUnit.Minute, unitNumber: 30 },
  '1h':  { unit: BarTimeUnit.Hour, unitNumber: 1 },
  '4h':  { unit: BarTimeUnit.Hour, unitNumber: 4 },
  '1d':  { unit: BarTimeUnit.Day, unitNumber: 1 },
  '1w':  { unit: BarTimeUnit.Week, unitNumber: 1 },
};

/**
 * Parse a user-friendly interval string into BarTimeUnit and unitNumber.
 *
 * @param input - Interval string (e.g. "5m", "1h", "1d")
 * @returns Object with unit (BarTimeUnit value) and unitNumber
 * @throws {ValidationError} When input is not a recognized interval
 */
export function parseInterval(input: string): { unit: number; unitNumber: number } {
  const entry = INTERVAL_MAP[input.toLowerCase()];

  if (!entry) {
    throw new ValidationError(
      `Invalid interval: "${input}". Valid: ${Object.keys(INTERVAL_MAP).join(', ')}`,
      { field: 'interval' },
    );
  }

  return entry;
}

// ─── History API Wrapper ───────────────────────────────────────────

/** Parameters for the retrieveBars API call */
export interface RetrieveBarsParams {
  contractId: string;
  startTime: string;
  endTime: string;
  unit: number;
  unitNumber: number;
  limit: number;
  includePartialBar?: boolean;
}

/**
 * Retrieve historical OHLCV bars from the TopStepX History API.
 *
 * Uses /History/ in the endpoint path which automatically routes through
 * the historyLimiter (50 req/30s) in apiPost (SAF-03, MKT-06).
 *
 * @param token - JWT authentication token
 * @param params - Bar retrieval parameters
 * @returns BarResponse with array of OHLCV bars
 */
export async function retrieveBars(
  token: string,
  params: RetrieveBarsParams,
): Promise<BarResponse> {
  return apiPost<BarResponse>(
    '/History/retrieveBars',
    {
      ...params,
      live: false,
      includePartialBar: params.includePartialBar ?? false,
    },
    token,
  );
}
