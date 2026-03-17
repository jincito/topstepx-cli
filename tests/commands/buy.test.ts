import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// ─── Mock modules before import ────────────────────────────────────
vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

vi.mock('../../src/services/symbol-resolver.js', () => ({
  resolveSymbol: vi.fn(),
}));

vi.mock('../../src/services/account-resolver.js', () => ({
  resolveAccountId: vi.fn(),
}));

vi.mock('../../src/api/orders.js', () => ({
  placeOrder: vi.fn(),
}));

vi.mock('../../src/services/order-builder.js', () => ({
  determineOrderType: vi.fn(),
  buildBrackets: vi.fn(),
  validateQuantity: vi.fn(),
  formatConfirmMessage: vi.fn(),
}));

vi.mock('@inquirer/confirm', () => ({
  default: vi.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────
import { createBuyCommand, createOrderCommand } from '../../src/commands/buy.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveSymbol } from '../../src/services/symbol-resolver.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { placeOrder } from '../../src/api/orders.js';
import {
  determineOrderType,
  buildBrackets,
  validateQuantity,
  formatConfirmMessage,
} from '../../src/services/order-builder.js';
import confirm from '@inquirer/confirm';
import { AuthError } from '../../src/errors/index.js';
import { OrderSide, OrderType } from '../../src/types/enums.js';

// ─── Typed mocks ──────────────────────────────────────────────────
const mockLoadToken = vi.mocked(loadToken);
const mockResolveSymbol = vi.mocked(resolveSymbol);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const mockPlaceOrder = vi.mocked(placeOrder);
const mockDetermineOrderType = vi.mocked(determineOrderType);
const mockBuildBrackets = vi.mocked(buildBrackets);
const mockValidateQuantity = vi.mocked(validateQuantity);
const mockFormatConfirmMessage = vi.mocked(formatConfirmMessage);
const mockConfirm = vi.mocked(confirm);

// ─── Test helpers ─────────────────────────────────────────────────

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createBuyCommand();
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
  mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
  mockResolveAccountId.mockResolvedValue(12345);
  mockValidateQuantity.mockReturnValue(1);
  mockDetermineOrderType.mockReturnValue({
    type: OrderType.Market,
    limitPrice: null,
    stopPrice: null,
  });
  mockBuildBrackets.mockReturnValue({
    stopLossBracket: null,
    takeProfitBracket: null,
  });
  mockFormatConfirmMessage.mockReturnValue('Place BUY 1 ES (Market)?');
  mockConfirm.mockResolvedValue(true);
  mockPlaceOrder.mockResolvedValue({
    orderId: 99001,
    success: true,
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('buyCommand', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    originalIsTTY = process.stdin.isTTY;
    // Default: simulate TTY so confirm prompt doesn't throw
    Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true, configurable: true });
  });

  afterEach(() => {
    writeSpy.mockRestore();
    stderrSpy.mockRestore();
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true, configurable: true });
  });

  it('is a Commander Command with name "buy"', () => {
    const cmd = createBuyCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('buy');
  });

  it('exports createOrderCommand factory', () => {
    expect(typeof createOrderCommand).toBe('function');
  });

  // ─── Market order ──────────────────────────────────────────────
  it('places market buy order with --yes', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--yes'], { from: 'user' });

    expect(mockPlaceOrder).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      side: OrderSide.Bid,
      type: OrderType.Market,
      size: 1,
      contractId: 'CON.F.US.EP.U25',
      accountId: 12345,
    }));
  });

  // ─── Limit order ───────────────────────────────────────────────
  it('places limit buy order with --limit flag', async () => {
    setupDefaults();
    mockDetermineOrderType.mockReturnValue({
      type: OrderType.Limit,
      limitPrice: 5500,
      stopPrice: null,
    });
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--limit', '5500', '--yes'], { from: 'user' });

    expect(mockPlaceOrder).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      type: OrderType.Limit,
      limitPrice: 5500,
    }));
  });

  // ─── Stop order ────────────────────────────────────────────────
  it('places stop buy order with --stop flag', async () => {
    setupDefaults();
    mockDetermineOrderType.mockReturnValue({
      type: OrderType.Stop,
      limitPrice: null,
      stopPrice: 5400,
    });
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--stop', '5400', '--yes'], { from: 'user' });

    expect(mockPlaceOrder).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      type: OrderType.Stop,
      stopPrice: 5400,
    }));
  });

  // ─── Stop-limit order ─────────────────────────────────────────
  it('places stop-limit order with --stop-limit flag', async () => {
    setupDefaults();
    mockDetermineOrderType.mockReturnValue({
      type: OrderType.StopLimit,
      stopPrice: 5400,
      limitPrice: 5395,
    });
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--stop-limit', '5400', '5395', '--yes'], { from: 'user' });

    expect(mockDetermineOrderType).toHaveBeenCalledWith(expect.objectContaining({
      stopLimit: ['5400', '5395'],
    }));
    expect(mockPlaceOrder).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      type: OrderType.StopLimit,
      stopPrice: 5400,
      limitPrice: 5395,
    }));
  });

  // ─── Bracket order ────────────────────────────────────────────
  it('attaches bracket objects with --bracket flag', async () => {
    setupDefaults();
    mockBuildBrackets.mockReturnValue({
      stopLossBracket: { ticks: 10, type: OrderType.Limit },
      takeProfitBracket: { ticks: 20, type: OrderType.Limit },
    });
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--bracket', '10', '20', '--yes'], { from: 'user' });

    expect(mockBuildBrackets).toHaveBeenCalledWith(['10', '20']);
    expect(mockPlaceOrder).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      stopLossBracket: { ticks: 10, type: OrderType.Limit },
      takeProfitBracket: { ticks: 20, type: OrderType.Limit },
    }));
  });

  // ─── Custom tag ────────────────────────────────────────────────
  it('passes custom tag with --tag flag', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--tag', 'myorder', '--yes'], { from: 'user' });

    expect(mockPlaceOrder).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      customTag: 'myorder',
    }));
  });

  // ─── Confirmation prompt ──────────────────────────────────────
  it('shows confirmation prompt when --yes is not set', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1'], { from: 'user' });

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Place BUY 1 ES (Market)?',
      default: false,
    }));
    expect(mockPlaceOrder).toHaveBeenCalled();
  });

  it('skips confirmation prompt with --yes flag', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--yes'], { from: 'user' });

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockPlaceOrder).toHaveBeenCalled();
  });

  it('cancels order when confirmation is denied', async () => {
    setupDefaults();
    mockConfirm.mockResolvedValue(false);
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1'], { from: 'user' });

    expect(mockPlaceOrder).not.toHaveBeenCalled();
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Order cancelled');
  });

  // ─── Non-TTY rejection ────────────────────────────────────────
  it('throws ValidationError for non-TTY stdin without --yes', async () => {
    setupDefaults();
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true });
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['buy', 'ES', '1'], { from: 'user' }),
    ).rejects.toThrow('Order requires confirmation');
  });

  it('allows non-TTY stdin with --yes flag', async () => {
    setupDefaults();
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true });
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--yes'], { from: 'user' });

    expect(mockPlaceOrder).toHaveBeenCalled();
  });

  // ─── Auth check ───────────────────────────────────────────────
  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['buy', 'ES', '1', '--yes'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });

  // ─── Symbol resolution ────────────────────────────────────────
  it('resolves symbol via resolveSymbol', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--yes'], { from: 'user' });

    expect(mockResolveSymbol).toHaveBeenCalledWith('ES', 'test-jwt');
  });

  // ─── Account resolution ───────────────────────────────────────
  it('resolves account via resolveAccountId with globals', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--yes', '--account', '99'], { from: 'user' });

    expect(mockResolveAccountId).toHaveBeenCalledWith(
      expect.objectContaining({ account: '99' }),
      'test-jwt',
    );
  });

  // ─── Output columns ──────────────────────────────────────────
  it('displays order confirmation with field/value rows', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--yes', '--no-color'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toContain('Order ID');
    expect(stdoutOutput).toContain('99001');
    expect(stdoutOutput).toContain('Side');
    expect(stdoutOutput).toContain('BUY');
    expect(stdoutOutput).toContain('Type');
    expect(stdoutOutput).toContain('Symbol');
    expect(stdoutOutput).toContain('Quantity');
  });

  // ─── JSON output ──────────────────────────────────────────────
  it('outputs valid JSON with --json flag', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--yes', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty('field', 'Order ID');
    expect(parsed[0]).toHaveProperty('value', 99001);
  });

  // ─── Order request completeness ───────────────────────────────
  it('sends complete PlaceOrderRequest with all fields', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['buy', 'ES', '1', '--yes'], { from: 'user' });

    expect(mockPlaceOrder).toHaveBeenCalledWith('test-jwt', {
      accountId: 12345,
      contractId: 'CON.F.US.EP.U25',
      type: OrderType.Market,
      side: OrderSide.Bid,
      size: 1,
      limitPrice: null,
      stopPrice: null,
      trailPrice: null,
      customTag: null,
      stopLossBracket: null,
      takeProfitBracket: null,
    });
  });
});
