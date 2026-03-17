import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// ─── Mock modules before import ────────────────────────────────────
vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

vi.mock('../../src/services/account-resolver.js', () => ({
  resolveAccountId: vi.fn(),
}));

vi.mock('../../src/api/orders.js', () => ({
  cancelOrder: vi.fn(),
}));

vi.mock('@inquirer/confirm', () => ({
  default: vi.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────
import { createCancelCommand } from '../../src/commands/cancel.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { cancelOrder } from '../../src/api/orders.js';
import confirm from '@inquirer/confirm';
import { AuthError } from '../../src/errors/index.js';

// ─── Typed mocks ──────────────────────────────────────────────────
const mockLoadToken = vi.mocked(loadToken);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const mockCancelOrder = vi.mocked(cancelOrder);
const mockConfirm = vi.mocked(confirm);

// ─── Test helpers ─────────────────────────────────────────────────

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createCancelCommand();
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
  mockCancelOrder.mockResolvedValue({
    success: true,
  });
  mockConfirm.mockResolvedValue(true);
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('cancelCommand', () => {
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

  it('is a Commander Command with name "cancel"', () => {
    const cmd = createCancelCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('cancel');
  });

  // ─── Confirmation shown ───────────────────────────────────────
  it('shows confirmation prompt before canceling', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['cancel', '12345'], { from: 'user' });

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('12345'),
      default: false,
    }));
    expect(mockCancelOrder).toHaveBeenCalled();
  });

  // ─── --yes skips confirmation ─────────────────────────────────
  it('skips confirmation prompt with --yes flag', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['cancel', '12345', '--yes'], { from: 'user' });

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockCancelOrder).toHaveBeenCalledWith('test-jwt', 12345, 12345);
  });

  // ─── Non-TTY error ────────────────────────────────────────────
  it('throws ValidationError for non-TTY stdin without --yes', async () => {
    setupDefaults();
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true });
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['cancel', '12345'], { from: 'user' }),
    ).rejects.toThrow('requires confirmation');
  });

  // ─── Successful cancel ────────────────────────────────────────
  it('calls cancelOrder and displays success', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['cancel', '12345', '--yes', '--no-color'], { from: 'user' });

    expect(mockCancelOrder).toHaveBeenCalledWith('test-jwt', 12345, 12345);
    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toContain('Order ID');
    expect(stdoutOutput).toContain('12345');
    expect(stdoutOutput).toContain('Cancelled');
  });

  // ─── Invalid orderId error ────────────────────────────────────
  it('throws ValidationError for non-numeric orderId', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['cancel', 'abc', '--yes'], { from: 'user' }),
    ).rejects.toThrow('Order ID must be a number');
  });

  // ─── Cancelled confirmation ───────────────────────────────────
  it('writes "Cancelled." to stderr when confirmation is denied', async () => {
    setupDefaults();
    mockConfirm.mockResolvedValue(false);
    const { program } = setupProgram();

    await program.parseAsync(['cancel', '12345'], { from: 'user' });

    expect(mockCancelOrder).not.toHaveBeenCalled();
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Cancelled.');
  });

  // ─── Auth check ───────────────────────────────────────────────
  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['cancel', '12345', '--yes'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });
});
