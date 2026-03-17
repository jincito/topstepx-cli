import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAvailableContracts } from '../api/contracts.js';
import { getConfigDir, ensureConfigDir } from '../config/paths.js';
import { ValidationError } from '../errors/validation-error.js';
import type { Contract } from '../types/api.js';

// ─── Friendly Symbol Map ────────────────────────────────────────────
// Maps common trading ticker symbols to TopStepX symbolId values.
// Users type "ES" instead of "F.US.EP" for convenience.

export const FRIENDLY_SYMBOL_MAP: Record<string, string> = {
  'ES': 'F.US.EP',       // E-mini S&P 500
  'NQ': 'F.US.ENQ',      // E-mini NASDAQ-100
  'MES': 'F.US.MES',     // Micro E-mini S&P 500
  'MNQ': 'F.US.MNQ',     // Micro E-mini NASDAQ-100
  'CL': 'F.US.CL',       // Crude Oil
  'GC': 'F.US.GC',       // Gold
  'RTY': 'F.US.RTY',     // E-mini Russell 2000
  'YM': 'F.US.YM',       // E-mini Dow Jones
  'MCL': 'F.US.MCL',     // Micro Crude Oil
  'MGC': 'F.US.MGC',     // Micro Gold
  'EUR': 'F.US.EU6',     // Euro FX
  'ZN': 'F.US.TY',       // 10-Year T-Note
  'ZB': 'F.US.US',       // 30-Year T-Bond
  'NG': 'F.US.NG',       // Natural Gas
  'SI': 'F.US.SI',       // Silver
};

// ─── Cache Types ────────────────────────────────────────────────────

interface ContractCache {
  fetchedAt: string;
  contracts: Contract[];
}

/** Cache time-to-live: 24 hours */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_FILENAME = 'contracts.json';

// ─── Cache Operations ───────────────────────────────────────────────

function getCachePath(): string {
  return join(getConfigDir(), CACHE_FILENAME);
}

function loadCache(): ContractCache | null {
  try {
    const raw = readFileSync(getCachePath(), 'utf-8');
    return JSON.parse(raw) as ContractCache;
  } catch {
    return null;
  }
}

function saveCache(contracts: Contract[]): void {
  try {
    ensureConfigDir();
    const cache: ContractCache = {
      fetchedAt: new Date().toISOString(),
      contracts,
    };
    writeFileSync(getCachePath(), JSON.stringify(cache), 'utf-8');
  } catch {
    // Non-critical: cache write failure should not break resolution
  }
}

function isCacheValid(cache: ContractCache): boolean {
  const age = Date.now() - new Date(cache.fetchedAt).getTime();
  return age < CACHE_TTL_MS;
}

// ─── Contract Resolution ────────────────────────────────────────────

async function getCachedContracts(token: string): Promise<Contract[]> {
  const cache = loadCache();
  if (cache && isCacheValid(cache)) {
    return cache.contracts;
  }

  // Cache miss or expired -- fetch from API
  const response = await getAvailableContracts(token);
  saveCache(response.contracts);
  return response.contracts;
}

/**
 * Resolve a user-provided symbol input to a full contractId.
 *
 * Resolution strategy:
 * 1. Full contractId passthrough (starts with "CON.")
 * 2. Exact contract name match (case-insensitive, active only)
 * 3. Friendly symbol map lookup (ES -> F.US.EP, active only)
 * 4. Throw ValidationError with helpful message
 *
 * @param input - User input: full contractId, contract name, or friendly symbol
 * @param token - JWT authentication token for cache refresh
 * @returns Full contractId string (e.g. "CON.F.US.EP.U25")
 * @throws {ValidationError} When symbol cannot be resolved
 */
export async function resolveSymbol(
  input: string,
  token: string,
): Promise<string> {
  // 1. Full contractId passthrough
  if (input.startsWith('CON.')) {
    return input;
  }

  const contracts = await getCachedContracts(token);
  const upper = input.toUpperCase();

  // 2. Exact name match (case-insensitive, active contracts only)
  const exactMatch = contracts.find(
    (c) => c.name.toUpperCase() === upper && c.activeContract,
  );
  if (exactMatch) {
    return exactMatch.id;
  }

  // 3. Friendly symbol map lookup
  const symbolId = FRIENDLY_SYMBOL_MAP[upper];
  if (symbolId) {
    const match = contracts.find(
      (c) => c.symbolId === symbolId && c.activeContract,
    );
    if (match) {
      return match.id;
    }
  }

  // 4. No match found
  throw new ValidationError(
    `Unknown symbol: "${input}". Use "topstep contracts" to search.`,
    { field: 'symbol' },
  );
}
