import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// ─── Mock modules before import ────────────────────────────────────
vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

vi.mock('../../src/services/account-resolver.js', () => ({
  resolveAccountId: vi.fn(),
}));

vi.mock('../../src/services/symbol-resolver.js', () => ({
  resolveSymbol: vi.fn(),
}));

vi.mock('../../src/api/trades.js', () => ({
  searchTrades: vi.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────
import { createTradesCommand } from '../../src/commands/trades.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { resolveSymbol } from '../../src/services/symbol-resolver.js';
import { searchTrades } from '../../src/api/trades.js';
import { AuthError } from '../../src/errors/index.js';
import { OrderSide } from '../../src/types/enums.js';

// ─── Typed mocks ──────────────────────────────────────────────────
const mockLoadToken = vi.mocked(loadToken);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const mockResolveSymbol = vi.mocked(resolveSymbol);
const mockSearchTrades = vi.mocked(searchTrades);

// ─── Test helpers ─────────────────────────────────────────────────

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createTradesCommand();
  const program = new Command();
  program
    .option('--json', 'JSON output')
    .option('--no-color', 'No color')
    .option('--verbose', 'Verbose')
    .option('--account <id>', 'Account ID');
  program.addCommand(cmd);
  return { program, cmd };
}

const SAMPLE_TRADES = [
  {
    id: 1001,
    accountId: 12345,
    contractId: 'CON.F.US.EP.U25',
    creationTimestamp: '2026-03-14T10:00:00Z',
    price: 5500.25,
    profitAndLoss: 125.50,
    fees: 2.50,
    side: OrderSide.Bid,
    size: 1,
    voided: false,
    orderId: 500,
  },
  {
    id: 1002,
    accountId: 12345,
    contractId: 'CON.F.US.ENQ.U25',
    creationTimestamp: '2026-03-14T11:00:00Z',
    price: 19800,
    profitAndLoss: null,    // half-turn trade
    fees: 3.00,
    side: OrderSide.Ask,
    size: 2,
    voided: false,
    orderId: 501,
  },
];

function setupDefaults(): void {
  mockLoadToken.mockReturnValue({
    token: 'test-jwt',
    acquiredAt: '2026-03-14T00:00:00.000Z',
    expiresAt: '2026-03-15T00:00:00.000Z',
    username: 'user1',
  });
  mockResolveAccountId.mockResolvedValue(12345);
  mockSearchTrades.mockResolvedValue({
    trades: SAMPLE_TRADES,
    success: true,
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('tradesCommand', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('is a Commander Command with name "trades"', () => {
    const cmd = createTradesCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('trades');
  });

  // ─── Default 7-day window ──────────────────────────────────────
  it('calls searchTrades with 7-day default startTimestamp', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trades'], { from: 'user' });

    expect(mockSearchTrades).toHaveBeenCalledWith(
      'test-jwt',
      12345,
      expect.any(String),
      undefined,
    );
    // Verify the start timestamp is approximately 7 days ago
    const callArgs = mockSearchTrades.mock.calls[0];
    const startDate = new Date(callArgs[2]);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(startDate.getTime() - sevenDaysAgo)).toBeLessThan(5000);
  });

  // ─── --from sets startTimestamp ─────────────────────────────────
  it('uses --from as startTimestamp', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trades', '--from', '2026-03-01'], { from: 'user' });

    expect(mockSearchTrades).toHaveBeenCalledWith(
      'test-jwt',
      12345,
      expect.stringContaining('2026-03-01'),
      undefined,
    );
  });

  // ─── --to sets endTimestamp ─────────────────────────────────────
  it('uses --to as endTimestamp', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trades', '--to', '2026-03-07'], { from: 'user' });

    expect(mockSearchTrades).toHaveBeenCalledWith(
      'test-jwt',
      12345,
      expect.any(String),
      expect.stringContaining('2026-03-07'),
    );
  });

  // ─── --symbol filters client-side ───────────────────────────────
  it('filters trades by resolved contractId when --symbol set', async () => {
    setupDefaults();
    mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
    const { program } = setupProgram();

    await program.parseAsync(['trades', '--symbol', 'ES', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].contractId).toBe('CON.F.US.EP.U25');
  });

  // ─── --limit truncation ─────────────────────────────────────────
  it('limits displayed results with --limit flag', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trades', '--limit', '1', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed).toHaveLength(1);
  });

  // ─── Null P&L displayed as '--' ─────────────────────────────────
  it('displays "--" for null profitAndLoss (half-turn trade)', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trades', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    // trade 1002 has null P&L
    const halfTurn = parsed.find((t: Record<string, unknown>) => t.id === 1002);
    expect(halfTurn.pnl).toBe('--');
  });

  // ─── Non-null P&L formatted ─────────────────────────────────────
  it('formats non-null profitAndLoss with toFixed(2)', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trades', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    const fullTurn = parsed.find((t: Record<string, unknown>) => t.id === 1001);
    expect(fullTurn.pnl).toBe('125.50');
  });

  // ─── Fees formatted ────────────────────────────────────────────
  it('formats fees with toFixed(2)', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trades', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed[0].fees).toBe('2.50');
  });

  // ─── Side uses orderSideLabel (SAF-01) ──────────────────────────
  it('displays side via orderSideLabel (SAF-01)', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trades', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed[0].side).toBe('BUY');
    expect(parsed[1].side).toBe('SELL');
  });

  // ─── Empty results ──────────────────────────────────────────────
  it('prints "No trades found." to stderr when no results', async () => {
    setupDefaults();
    mockSearchTrades.mockResolvedValue({
      trades: [],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['trades'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('No trades found.');
  });

  // ─── Auth check ────────────────────────────────────────────────
  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['trades'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });
});
