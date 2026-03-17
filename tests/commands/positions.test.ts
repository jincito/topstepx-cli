import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// ─── Mock modules before import ────────────────────────────────────
vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

vi.mock('../../src/services/account-resolver.js', () => ({
  resolveAccountId: vi.fn(),
}));

vi.mock('../../src/api/positions.js', () => ({
  searchOpenPositions: vi.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────
import { createPositionsCommand } from '../../src/commands/positions.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { searchOpenPositions } from '../../src/api/positions.js';
import { AuthError } from '../../src/errors/index.js';
import { PositionType } from '../../src/types/enums.js';

// ─── Typed mocks ──────────────────────────────────────────────────
const mockLoadToken = vi.mocked(loadToken);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const mockSearchOpenPositions = vi.mocked(searchOpenPositions);

// ─── Test helpers ─────────────────────────────────────────────────

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createPositionsCommand();
  const program = new Command();
  program
    .option('--json', 'JSON output')
    .option('--no-color', 'No color')
    .option('--verbose', 'Verbose')
    .option('--account <id>', 'Account ID');
  program.addCommand(cmd);
  return { program, cmd };
}

function setupDefaults(): void {
  mockLoadToken.mockReturnValue({
    token: 'test-jwt',
    acquiredAt: '2026-03-14T00:00:00.000Z',
    expiresAt: '2026-03-15T00:00:00.000Z',
    username: 'user1',
  });
  mockResolveAccountId.mockResolvedValue(12345);
  mockSearchOpenPositions.mockResolvedValue({
    positions: [
      {
        id: 1,
        accountId: 12345,
        contractId: 'CON.F.US.EP.U25',
        creationTimestamp: '2026-03-14T10:00:00Z',
        type: PositionType.Long,
        size: 2,
        averagePrice: 5500.25,
      },
    ],
    success: true,
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('positionsCommand', () => {
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

  it('is a Commander Command with name "positions"', () => {
    const cmd = createPositionsCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('positions');
  });

  // ─── Positions displayed with positionTypeLabel ─────────────────
  it('calls searchOpenPositions and displays results with labels', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['positions', '--no-color'], { from: 'user' });

    expect(mockSearchOpenPositions).toHaveBeenCalledWith('test-jwt', 12345);
    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toContain('CON.F.US.EP.U25');
    expect(stdoutOutput).toContain('Long');   // positionTypeLabel (SAF-01)
    expect(stdoutOutput).toContain('2');       // size
    expect(stdoutOutput).toContain('5500.25'); // averagePrice
  });

  // ─── P&L shows '--' ────────────────────────────────────────────
  it('displays "--" for unrealized P&L column', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['positions', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed[0].pnl).toBe('--');
  });

  // ─── Short position label ──────────────────────────────────────
  it('displays "Short" for PositionType.Short', async () => {
    setupDefaults();
    mockSearchOpenPositions.mockResolvedValue({
      positions: [
        {
          id: 2,
          accountId: 12345,
          contractId: 'CON.F.US.ENQ.U25',
          creationTimestamp: '2026-03-14T10:00:00Z',
          type: PositionType.Short,
          size: 1,
          averagePrice: 19800,
        },
      ],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['positions', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed[0].side).toBe('Short');
  });

  // ─── Empty results ──────────────────────────────────────────────
  it('prints "No open positions." to stderr when no results', async () => {
    setupDefaults();
    mockSearchOpenPositions.mockResolvedValue({
      positions: [],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['positions'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('No open positions.');
  });

  // ─── Auth check ────────────────────────────────────────────────
  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['positions'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });
});
