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
  searchOpenOrders: vi.fn(),
  cancelOrder: vi.fn(),
}));

vi.mock('@inquirer/confirm', () => ({
  default: vi.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────
import { createCancelAllCommand } from '../../src/commands/cancel-all.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { searchOpenOrders, cancelOrder } from '../../src/api/orders.js';
import confirm from '@inquirer/confirm';
import { AuthError } from '../../src/errors/index.js';
import { OrderSide, OrderType, OrderStatus } from '../../src/types/enums.js';

// ─── Typed mocks ──────────────────────────────────────────────────
const mockLoadToken = vi.mocked(loadToken);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const mockSearchOpenOrders = vi.mocked(searchOpenOrders);
const mockCancelOrder = vi.mocked(cancelOrder);
const mockConfirm = vi.mocked(confirm);

// ─── Test helpers ─────────────────────────────────────────────────

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createCancelAllCommand();
  const program = new Command();
  program
    .option('--json', 'JSON output')
    .option('--no-color', 'No color')
    .option('--verbose', 'Verbose')
    .option('--account <id>', 'Account ID');
  program.addCommand(cmd);
  return { program, cmd };
}

const SAMPLE_ORDERS = [
  {
    id: 100,
    accountId: 12345,
    contractId: 'CON.F.US.EP.U25',
    creationTimestamp: '2026-03-14T10:00:00Z',
    updateTimestamp: '2026-03-14T10:00:00Z',
    status: OrderStatus.Open,
    type: OrderType.Limit,
    side: OrderSide.Bid,
    size: 2,
    limitPrice: 5500,
    stopPrice: null,
    fillVolume: null,
    filledPrice: null,
    customTag: null,
  },
  {
    id: 200,
    accountId: 12345,
    contractId: 'CON.F.US.ENQ.U25',
    creationTimestamp: '2026-03-14T10:00:00Z',
    updateTimestamp: '2026-03-14T10:00:00Z',
    status: OrderStatus.Open,
    type: OrderType.Market,
    side: OrderSide.Ask,
    size: 1,
    limitPrice: null,
    stopPrice: null,
    fillVolume: null,
    filledPrice: null,
    customTag: null,
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
  mockSearchOpenOrders.mockResolvedValue({
    orders: SAMPLE_ORDERS,
    success: true,
  });
  mockCancelOrder.mockResolvedValue({ success: true });
  mockConfirm.mockResolvedValue(true);
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('cancelAllCommand', () => {
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

  it('is a Commander Command with name "cancel-all"', () => {
    const cmd = createCancelAllCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('cancel-all');
  });

  // ─── Empty orders ─────────────────────────────────────────────
  it('prints "No open orders to cancel." when no open orders', async () => {
    setupDefaults();
    mockSearchOpenOrders.mockResolvedValue({
      orders: [],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['cancel-all'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('No open orders to cancel.');
    expect(mockCancelOrder).not.toHaveBeenCalled();
  });

  // ─── Confirmation with count ──────────────────────────────────
  it('shows confirmation prompt with order count', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['cancel-all'], { from: 'user' });

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('2'),
      default: false,
    }));
  });

  // ─── --yes skips confirmation ─────────────────────────────────
  it('skips confirmation prompt with --yes flag', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['cancel-all', '--yes'], { from: 'user' });

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockCancelOrder).toHaveBeenCalledTimes(2);
  });

  // ─── All succeed ──────────────────────────────────────────────
  it('reports success count when all orders cancelled', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['cancel-all', '--yes'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Cancelled 2/2 order(s).');
  });

  // ─── Partial failure ──────────────────────────────────────────
  it('reports partial failure when some orders fail', async () => {
    setupDefaults();
    mockCancelOrder
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('API error'));
    const { program } = setupProgram();

    await program.parseAsync(['cancel-all', '--yes'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Cancelled 1/2 order(s).');
    expect(stderrOutput).toContain('1 failed.');
  });

  // ─── Non-TTY error ────────────────────────────────────────────
  it('throws ValidationError for non-TTY stdin without --yes', async () => {
    setupDefaults();
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true });
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['cancel-all'], { from: 'user' }),
    ).rejects.toThrow('requires confirmation');
  });

  // ─── Auth check ───────────────────────────────────────────────
  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['cancel-all', '--yes'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });

  // ─── Denied confirmation ──────────────────────────────────────
  it('writes "Cancelled." to stderr when confirmation is denied', async () => {
    setupDefaults();
    mockConfirm.mockResolvedValue(false);
    const { program } = setupProgram();

    await program.parseAsync(['cancel-all'], { from: 'user' });

    expect(mockCancelOrder).not.toHaveBeenCalled();
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Cancelled.');
  });
});
