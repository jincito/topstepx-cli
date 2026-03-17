import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock modules before imports -- vi.mock is hoisted, so no external refs in factory
vi.mock('../../src/services/market-hub.js', () => ({
  createMarketHubConnection: vi.fn(),
  fetchOneQuote: vi.fn(),
}));

vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

vi.mock('../../src/services/symbol-resolver.js', () => ({
  resolveSymbol: vi.fn(),
}));

import { createQuotesCommand } from '../../src/commands/quotes.js';
import { createMarketHubConnection, fetchOneQuote } from '../../src/services/market-hub.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveSymbol } from '../../src/services/symbol-resolver.js';
import { AuthError } from '../../src/errors/index.js';
import type { QuoteData } from '../../src/types/api.js';

const mockCreateConnection = vi.mocked(createMarketHubConnection);
const mockFetchOneQuote = vi.mocked(fetchOneQuote);
const mockLoadToken = vi.mocked(loadToken);
const mockResolveSymbol = vi.mocked(resolveSymbol);

const MOCK_QUOTE: QuoteData = {
  symbol: 'ESU5',
  symbolName: 'E-mini S&P 500',
  lastPrice: 5425.50,
  bestBid: 5425.25,
  bestAsk: 5425.75,
  change: 12.50,
  changePercent: 0.23,
  open: 5413.00,
  high: 5430.00,
  low: 5410.00,
  volume: 1234567,
  lastUpdated: '2026-03-14T16:00:00Z',
  timestamp: '2026-03-14T16:00:00Z',
};

// Create a fresh mock connection for each test
function createMockConnection() {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
}

describe('quotesCommand', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockConnection = createMockConnection();
    mockCreateConnection.mockReturnValue(mockConnection as any);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('is a Commander Command with name "quotes"', () => {
    const cmd = createQuotesCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('quotes');
  });

  it('resolves symbol via resolveSymbol before connecting', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', acquiredAt: '', expiresAt: '', username: 'user1' });
    mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
    mockFetchOneQuote.mockResolvedValue(MOCK_QUOTE);

    const cmd = createQuotesCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['quotes', 'ES', '--no-color'], { from: 'user' });

    expect(mockResolveSymbol).toHaveBeenCalledWith('ES', 'test-jwt');
    expect(mockCreateConnection).toHaveBeenCalledWith('test-jwt');
    expect(mockFetchOneQuote).toHaveBeenCalledWith(
      expect.anything(),
      'CON.F.US.EP.U25',
    );
  });

  it('displays bid, ask, last, change, volume in table format', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', acquiredAt: '', expiresAt: '', username: 'user1' });
    mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
    mockFetchOneQuote.mockResolvedValue(MOCK_QUOTE);

    const cmd = createQuotesCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['quotes', 'ES', '--no-color'], { from: 'user' });

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(output).toContain('Last');
    expect(output).toContain('Bid');
    expect(output).toContain('Ask');
    expect(output).toContain('Change');
    expect(output).toContain('Volume');
    expect(output).toContain('5425.5');
    expect(output).toContain('5425.25');
    expect(output).toContain('5425.75');
  });

  it('outputs valid JSON with --json flag', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', acquiredAt: '', expiresAt: '', username: 'user1' });
    mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
    mockFetchOneQuote.mockResolvedValue(MOCK_QUOTE);

    const cmd = createQuotesCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['quotes', 'ES', '--json'], { from: 'user' });

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    // Should contain quote field entries
    const fields = parsed.map((r: any) => r.field);
    expect(fields).toContain('Last');
    expect(fields).toContain('Bid');
    expect(fields).toContain('Ask');
  });

  it('throws AuthError when not authenticated (loadToken returns null)', async () => {
    mockLoadToken.mockReturnValue(null);

    const cmd = createQuotesCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await expect(
      program.parseAsync(['quotes', 'ES'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });

  it('shows informative message on timeout (market closed scenario)', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', acquiredAt: '', expiresAt: '', username: 'user1' });
    mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
    mockFetchOneQuote.mockRejectedValue(new Error('Timed out waiting for quote data'));

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    const cmd = createQuotesCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['quotes', 'ES', '--no-color'], { from: 'user' });

    const allOutput = [
      ...writeSpy.mock.calls.map((c) => String(c[0])),
      ...stderrSpy.mock.calls.map((c) => String(c[0])),
    ].join('');
    expect(allOutput).toContain('No quote received');

    exitSpy.mockRestore();
  });

  it('always calls connection.stop() (cleanup on success)', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', acquiredAt: '', expiresAt: '', username: 'user1' });
    mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
    mockFetchOneQuote.mockResolvedValue(MOCK_QUOTE);

    const cmd = createQuotesCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['quotes', 'ES', '--no-color'], { from: 'user' });

    expect(mockConnection.stop).toHaveBeenCalled();
  });

  it('always calls connection.stop() (cleanup on error)', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', acquiredAt: '', expiresAt: '', username: 'user1' });
    mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
    mockFetchOneQuote.mockRejectedValue(new Error('Timed out waiting for quote data'));

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    const cmd = createQuotesCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['quotes', 'ES', '--no-color'], { from: 'user' });

    expect(mockConnection.stop).toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});
