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

vi.mock('../../src/api/positions.js', () => ({
  searchOpenPositions: vi.fn(),
  closePosition: vi.fn(),
}));

vi.mock('@inquirer/confirm', () => ({
  default: vi.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────
import { createFlattenCommand } from '../../src/commands/flatten.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { resolveSymbol } from '../../src/services/symbol-resolver.js';
import { searchOpenPositions, closePosition } from '../../src/api/positions.js';
import confirm from '@inquirer/confirm';
import { AuthError } from '../../src/errors/index.js';
import { PositionType } from '../../src/types/enums.js';

// ─── Typed mocks ──────────────────────────────────────────────────
const mockLoadToken = vi.mocked(loadToken);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const mockResolveSymbol = vi.mocked(resolveSymbol);
const mockSearchOpenPositions = vi.mocked(searchOpenPositions);
const mockClosePosition = vi.mocked(closePosition);
const mockConfirm = vi.mocked(confirm);

// ─── Test helpers ─────────────────────────────────────────────────

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createFlattenCommand();
  const program = new Command();
  program
    .option('--json', 'JSON output')
    .option('--no-color', 'No color')
    .option('--verbose', 'Verbose')
    .option('--account <id>', 'Account ID');
  program.addCommand(cmd);
  return { program, cmd };
}

const SAMPLE_POSITIONS = [
  {
    id: 1,
    accountId: 12345,
    contractId: 'CON.F.US.EP.U25',
    creationTimestamp: '2026-03-14T10:00:00Z',
    type: PositionType.Long,
    size: 2,
    averagePrice: 5500.25,
  },
  {
    id: 2,
    accountId: 12345,
    contractId: 'CON.F.US.ENQ.U25',
    creationTimestamp: '2026-03-14T10:00:00Z',
    type: PositionType.Short,
    size: 1,
    averagePrice: 19800,
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
  mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
  mockSearchOpenPositions.mockResolvedValue({
    positions: SAMPLE_POSITIONS,
    success: true,
  });
  mockClosePosition.mockResolvedValue({ success: true });
  mockConfirm.mockResolvedValue(true);
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('flattenCommand', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true, configurable: true });
  });

  afterEach(() => {
    writeSpy.mockRestore();
    stderrSpy.mockRestore();
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true, configurable: true });
  });

  it('is a Commander Command with name "flatten"', () => {
    const cmd = createFlattenCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('flatten');
  });

  // ─── Single symbol flatten ─────────────────────────────────────
  it('resolves symbol and calls closePosition for single symbol', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['flatten', 'ES', '--yes', '--no-color'], { from: 'user' });

    expect(mockResolveSymbol).toHaveBeenCalledWith('ES', 'test-jwt');
    expect(mockClosePosition).toHaveBeenCalledWith('test-jwt', 12345, 'CON.F.US.EP.U25');
  });

  // ─── Flatten all positions ─────────────────────────────────────
  it('closes all positions when no symbol provided', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['flatten', '--yes'], { from: 'user' });

    expect(mockSearchOpenPositions).toHaveBeenCalledWith('test-jwt', 12345);
    expect(mockClosePosition).toHaveBeenCalledTimes(2);
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Closed 2/2 position(s).');
  });

  // ─── Empty positions ──────────────────────────────────────────
  it('prints "No open positions to flatten." when no positions', async () => {
    setupDefaults();
    mockSearchOpenPositions.mockResolvedValue({
      positions: [],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['flatten', '--yes'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('No open positions to flatten.');
    expect(mockClosePosition).not.toHaveBeenCalled();
  });

  // ─── Confirmation prompt shown for single symbol ───────────────
  it('shows confirmation prompt for single symbol', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['flatten', 'ES'], { from: 'user' });

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('ES'),
      default: false,
    }));
  });

  // ─── Confirmation prompt shown for all positions ───────────────
  it('shows confirmation prompt with position count for flatten all', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['flatten'], { from: 'user' });

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('2'),
      default: false,
    }));
  });

  // ─── --yes skips confirmation ──────────────────────────────────
  it('skips confirmation prompt with --yes flag', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['flatten', 'ES', '--yes'], { from: 'user' });

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockClosePosition).toHaveBeenCalled();
  });

  // ─── Non-TTY error ─────────────────────────────────────────────
  it('throws ValidationError for non-TTY stdin without --yes', async () => {
    setupDefaults();
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true });
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['flatten', 'ES'], { from: 'user' }),
    ).rejects.toThrow('requires confirmation');
  });

  // ─── Partial failure handling ──────────────────────────────────
  it('reports partial failure when some closes fail', async () => {
    setupDefaults();
    mockClosePosition
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('API error'));
    const { program } = setupProgram();

    await program.parseAsync(['flatten', '--yes'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Closed 1/2 position(s).');
    expect(stderrOutput).toContain('1 failed.');
  });

  // ─── Auth check ────────────────────────────────────────────────
  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['flatten', '--yes'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });

  // ─── Denied confirmation ───────────────────────────────────────
  it('writes message to stderr when confirmation is denied', async () => {
    setupDefaults();
    mockConfirm.mockResolvedValue(false);
    const { program } = setupProgram();

    await program.parseAsync(['flatten', 'ES'], { from: 'user' });

    expect(mockClosePosition).not.toHaveBeenCalled();
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Cancelled.');
  });
});
