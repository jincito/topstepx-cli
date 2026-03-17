import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetAvailableContracts, mockReadFileSync, mockWriteFileSync, mockGetConfigDir, mockEnsureConfigDir } = vi.hoisted(() => {
  return {
    mockGetAvailableContracts: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
    mockGetConfigDir: vi.fn().mockReturnValue('/mock/.config/topstepx'),
    mockEnsureConfigDir: vi.fn().mockReturnValue('/mock/.config/topstepx'),
  };
});

vi.mock('../../src/api/contracts.js', () => ({
  getAvailableContracts: mockGetAvailableContracts,
}));

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: mockGetConfigDir,
  ensureConfigDir: mockEnsureConfigDir,
}));

import { resolveSymbol, FRIENDLY_SYMBOL_MAP } from '../../src/services/symbol-resolver.js';
import { ValidationError } from '../../src/errors/validation-error.js';

// Sample contracts for test fixtures
const SAMPLE_CONTRACTS = [
  {
    id: 'CON.F.US.EP.U25',
    name: 'ESU5',
    description: 'E-mini S&P 500: September 2025',
    tickSize: 0.25,
    tickValue: 12.5,
    activeContract: true,
    symbolId: 'F.US.EP',
  },
  {
    id: 'CON.F.US.ENQ.U25',
    name: 'NQU5',
    description: 'E-mini NASDAQ-100: September 2025',
    tickSize: 0.25,
    tickValue: 5,
    activeContract: true,
    symbolId: 'F.US.ENQ',
  },
  {
    id: 'CON.F.US.CL.U25',
    name: 'CLU5',
    description: 'Crude Oil: September 2025',
    tickSize: 0.01,
    tickValue: 10,
    activeContract: true,
    symbolId: 'F.US.CL',
  },
  {
    id: 'CON.F.US.EP.Z24',
    name: 'ESZ4',
    description: 'E-mini S&P 500: December 2024',
    tickSize: 0.25,
    tickValue: 12.5,
    activeContract: false,
    symbolId: 'F.US.EP',
  },
];

describe('services/symbol-resolver', () => {
  beforeEach(() => {
    mockGetAvailableContracts.mockReset();
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
  });

  describe('FRIENDLY_SYMBOL_MAP', () => {
    it('maps ES to F.US.EP', () => {
      expect(FRIENDLY_SYMBOL_MAP['ES']).toBe('F.US.EP');
    });

    it('maps NQ to F.US.ENQ', () => {
      expect(FRIENDLY_SYMBOL_MAP['NQ']).toBe('F.US.ENQ');
    });

    it('maps CL to F.US.CL', () => {
      expect(FRIENDLY_SYMBOL_MAP['CL']).toBe('F.US.CL');
    });

    it('contains all expected symbols', () => {
      const expectedSymbols = [
        'ES', 'NQ', 'MES', 'MNQ', 'CL', 'GC', 'RTY', 'YM',
        'MCL', 'MGC', 'EUR', 'ZN', 'ZB', 'NG', 'SI',
      ];
      for (const symbol of expectedSymbols) {
        expect(FRIENDLY_SYMBOL_MAP).toHaveProperty(symbol);
      }
    });
  });

  describe('resolveSymbol', () => {
    it('returns full contractId as-is when input starts with CON.', async () => {
      const result = await resolveSymbol('CON.F.US.EP.U25', 'test-token');

      expect(result).toBe('CON.F.US.EP.U25');
      expect(mockGetAvailableContracts).not.toHaveBeenCalled();
    });

    it('resolves friendly name ES via FRIENDLY_SYMBOL_MAP to active contract id', async () => {
      // No cache -- triggers API call
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: SAMPLE_CONTRACTS,
      });

      const result = await resolveSymbol('ES', 'test-token');

      expect(result).toBe('CON.F.US.EP.U25');
    });

    it('resolves friendly name in lowercase', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: SAMPLE_CONTRACTS,
      });

      const result = await resolveSymbol('es', 'test-token');

      expect(result).toBe('CON.F.US.EP.U25');
    });

    it('resolves exact contract name match (case-insensitive)', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: SAMPLE_CONTRACTS,
      });

      const result = await resolveSymbol('ESU5', 'test-token');

      expect(result).toBe('CON.F.US.EP.U25');
    });

    it('resolves exact name match case-insensitively (lowercase)', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: SAMPLE_CONTRACTS,
      });

      const result = await resolveSymbol('esu5', 'test-token');

      expect(result).toBe('CON.F.US.EP.U25');
    });

    it('throws ValidationError for unknown symbol', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: SAMPLE_CONTRACTS,
      });

      await expect(
        resolveSymbol('UNKNOWN', 'test-token'),
      ).rejects.toThrow(ValidationError);

      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: SAMPLE_CONTRACTS,
      });

      await expect(
        resolveSymbol('UNKNOWN', 'test-token'),
      ).rejects.toThrow('Unknown symbol: "UNKNOWN"');
    });

    it('only matches active contracts for friendly name resolution', async () => {
      // Only expired ES contract (activeContract: false)
      const onlyExpired = [
        {
          id: 'CON.F.US.EP.Z24',
          name: 'ESZ4',
          description: 'E-mini S&P 500: December 2024',
          tickSize: 0.25,
          tickValue: 12.5,
          activeContract: false,
          symbolId: 'F.US.EP',
        },
      ];

      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: onlyExpired,
      });

      await expect(
        resolveSymbol('ES', 'test-token'),
      ).rejects.toThrow(ValidationError);
    });

    it('uses valid cache and skips API call', async () => {
      const validCache = {
        fetchedAt: new Date().toISOString(), // Fresh timestamp
        contracts: SAMPLE_CONTRACTS,
      };
      mockReadFileSync.mockReturnValueOnce(JSON.stringify(validCache));

      const result = await resolveSymbol('NQ', 'test-token');

      expect(result).toBe('CON.F.US.ENQ.U25');
      expect(mockGetAvailableContracts).not.toHaveBeenCalled();
    });

    it('re-fetches when cache is older than 24 hours', async () => {
      const expiredCache = {
        fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago
        contracts: [],
      };
      mockReadFileSync.mockReturnValueOnce(JSON.stringify(expiredCache));
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: SAMPLE_CONTRACTS,
      });

      const result = await resolveSymbol('CL', 'test-token');

      expect(result).toBe('CON.F.US.CL.U25');
      expect(mockGetAvailableContracts).toHaveBeenCalledOnce();
    });

    it('treats corrupted cache JSON as cache miss and re-fetches', async () => {
      mockReadFileSync.mockReturnValueOnce('{ invalid json!!!');
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: SAMPLE_CONTRACTS,
      });

      const result = await resolveSymbol('ES', 'test-token');

      expect(result).toBe('CON.F.US.EP.U25');
      expect(mockGetAvailableContracts).toHaveBeenCalledOnce();
    });

    it('writes cache file after fetching from API', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      mockGetAvailableContracts.mockResolvedValueOnce({
        success: true,
        contracts: SAMPLE_CONTRACTS,
      });

      await resolveSymbol('ES', 'test-token');

      expect(mockWriteFileSync).toHaveBeenCalledOnce();
      const [filePath, content] = mockWriteFileSync.mock.calls[0];
      expect(filePath).toContain('contracts.json');
      const parsed = JSON.parse(content as string);
      expect(parsed.fetchedAt).toBeDefined();
      expect(parsed.contracts).toEqual(SAMPLE_CONTRACTS);
    });
  });
});
