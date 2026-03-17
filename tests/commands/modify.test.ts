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
  modifyOrder: vi.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────
import { createModifyCommand } from '../../src/commands/modify.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { modifyOrder } from '../../src/api/orders.js';
import { AuthError, ValidationError } from '../../src/errors/index.js';

// ─── Typed mocks ──────────────────────────────────────────────────
const mockLoadToken = vi.mocked(loadToken);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const mockModifyOrder = vi.mocked(modifyOrder);

// ─── Test helpers ─────────────────────────────────────────────────

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createModifyCommand();
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
  mockModifyOrder.mockResolvedValue({
    success: true,
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('modifyCommand', () => {
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

  it('is a Commander Command with name "modify"', () => {
    const cmd = createModifyCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('modify');
  });

  // ─── --limit sends only limitPrice ────────────────────────────
  it('sends modifyOrder with limitPrice only when --limit is set', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['modify', '12345', '--limit', '5510'], { from: 'user' });

    expect(mockModifyOrder).toHaveBeenCalledWith('test-jwt', {
      accountId: 12345,
      orderId: 12345,
      limitPrice: 5510,
    });
  });

  // ─── --stop sends only stopPrice ──────────────────────────────
  it('sends modifyOrder with stopPrice only when --stop is set', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['modify', '12345', '--stop', '5400'], { from: 'user' });

    expect(mockModifyOrder).toHaveBeenCalledWith('test-jwt', {
      accountId: 12345,
      orderId: 12345,
      stopPrice: 5400,
    });
  });

  // ─── --size sends only size ───────────────────────────────────
  it('sends modifyOrder with size only when --size is set', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['modify', '12345', '--size', '2'], { from: 'user' });

    expect(mockModifyOrder).toHaveBeenCalledWith('test-jwt', {
      accountId: 12345,
      orderId: 12345,
      size: 2,
    });
  });

  // ─── No flags throws ValidationError ──────────────────────────
  it('throws ValidationError when no modify flags are provided', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['modify', '12345'], { from: 'user' }),
    ).rejects.toThrow('Specify at least one field to modify');
  });

  // ─── Invalid orderId throws ValidationError ───────────────────
  it('throws ValidationError for non-numeric orderId', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['modify', 'abc', '--limit', '5510'], { from: 'user' }),
    ).rejects.toThrow('Order ID must be a number');
  });

  // ─── Success output ───────────────────────────────────────────
  it('displays success message with orderId and changed fields', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['modify', '12345', '--limit', '5510', '--no-color'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toContain('Order ID');
    expect(stdoutOutput).toContain('12345');
    expect(stdoutOutput).toContain('Limit Price');
    expect(stdoutOutput).toContain('5510');
  });

  // ─── Auth check ───────────────────────────────────────────────
  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['modify', '12345', '--limit', '5510'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });

  // ─── Multiple fields ─────────────────────────────────────────
  it('sends multiple fields when multiple flags are set', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['modify', '12345', '--limit', '5510', '--size', '3'], { from: 'user' });

    expect(mockModifyOrder).toHaveBeenCalledWith('test-jwt', {
      accountId: 12345,
      orderId: 12345,
      limitPrice: 5510,
      size: 3,
    });
  });
});
