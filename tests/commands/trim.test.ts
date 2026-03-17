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
  partialClosePosition: vi.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────
import { createTrimCommand } from '../../src/commands/trim.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { resolveSymbol } from '../../src/services/symbol-resolver.js';
import { partialClosePosition } from '../../src/api/positions.js';
import { AuthError } from '../../src/errors/index.js';

// ─── Typed mocks ──────────────────────────────────────────────────
const mockLoadToken = vi.mocked(loadToken);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const mockResolveSymbol = vi.mocked(resolveSymbol);
const mockPartialClosePosition = vi.mocked(partialClosePosition);

// ─── Test helpers ─────────────────────────────────────────────────

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createTrimCommand();
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
  mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
  mockPartialClosePosition.mockResolvedValue({ success: true });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('trimCommand', () => {
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

  it('is a Commander Command with name "trim"', () => {
    const cmd = createTrimCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('trim');
  });

  // ─── Valid trim call ────────────────────────────────────────────
  it('resolves symbol and calls partialClosePosition', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trim', 'ES', '1', '--no-color'], { from: 'user' });

    expect(mockResolveSymbol).toHaveBeenCalledWith('ES', 'test-jwt');
    expect(mockPartialClosePosition).toHaveBeenCalledWith('test-jwt', 12345, 'CON.F.US.EP.U25', 1);
  });

  // ─── Success output ────────────────────────────────────────────
  it('displays success details after trim', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['trim', 'ES', '2', '--no-color'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toContain('ES');
    expect(stdoutOutput).toContain('CON.F.US.EP.U25');
    expect(stdoutOutput).toContain('2');
  });

  // ─── Invalid qty: NaN ──────────────────────────────────────────
  it('throws ValidationError for non-numeric qty', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['trim', 'ES', 'abc'], { from: 'user' }),
    ).rejects.toThrow('Quantity must be a positive whole number');
  });

  // ─── Invalid qty: zero ─────────────────────────────────────────
  it('throws ValidationError for zero qty', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['trim', 'ES', '0'], { from: 'user' }),
    ).rejects.toThrow('Quantity must be a positive whole number');
  });

  // ─── Invalid qty: negative ─────────────────────────────────────
  it('throws ValidationError for negative qty', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['trim', 'ES', '-1'], { from: 'user' }),
    ).rejects.toThrow('Quantity must be a positive whole number');
  });

  // ─── Invalid qty: decimal ──────────────────────────────────────
  it('throws ValidationError for decimal qty', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['trim', 'ES', '1.5'], { from: 'user' }),
    ).rejects.toThrow('Quantity must be a positive whole number');
  });

  // ─── Auth check ────────────────────────────────────────────────
  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['trim', 'ES', '1'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });
});
