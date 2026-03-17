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
import { createSellCommand } from '../../src/commands/sell.js';
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
  const cmd = createSellCommand();
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
  mockFormatConfirmMessage.mockReturnValue('Place SELL 1 ES (Market)?');
  mockConfirm.mockResolvedValue(true);
  mockPlaceOrder.mockResolvedValue({
    orderId: 99002,
    success: true,
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('sellCommand', () => {
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

  it('is a Commander Command with name "sell"', () => {
    const cmd = createSellCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('sell');
  });

  it('places market sell order with OrderSide.Ask', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['sell', 'ES', '1', '--yes'], { from: 'user' });

    expect(mockPlaceOrder).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      side: OrderSide.Ask,
      type: OrderType.Market,
      size: 1,
      contractId: 'CON.F.US.EP.U25',
      accountId: 12345,
    }));
  });

  it('uses OrderSide.Ask (not Bid) as side', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['sell', 'ES', '1', '--yes'], { from: 'user' });

    const orderRequest = mockPlaceOrder.mock.calls[0][1];
    expect(orderRequest.side).toBe(OrderSide.Ask);
    expect(orderRequest.side).toBe(1);
    expect(orderRequest.side).not.toBe(OrderSide.Bid);
  });

  it('displays SELL label in order confirmation', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['sell', 'ES', '1', '--yes', '--no-color'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toContain('SELL');
    expect(stdoutOutput).toContain('99002');
  });
});
