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
  searchOpenOrders: vi.fn(),
  searchOrders: vi.fn(),
}));

// ─── Imports ───────────────────────────────────────────────────────
import { createOrdersCommand } from '../../src/commands/orders.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveSymbol } from '../../src/services/symbol-resolver.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { searchOpenOrders, searchOrders } from '../../src/api/orders.js';
import { AuthError } from '../../src/errors/index.js';
import { OrderSide, OrderType, OrderStatus } from '../../src/types/enums.js';

// ─── Typed mocks ──────────────────────────────────────────────────
const mockLoadToken = vi.mocked(loadToken);
const mockResolveSymbol = vi.mocked(resolveSymbol);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const mockSearchOpenOrders = vi.mocked(searchOpenOrders);
const mockSearchOrders = vi.mocked(searchOrders);

// ─── Test helpers ─────────────────────────────────────────────────

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createOrdersCommand();
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
  mockSearchOpenOrders.mockResolvedValue({
    orders: [
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
    ],
    success: true,
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('ordersCommand', () => {
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

  it('is a Commander Command with name "orders"', () => {
    const cmd = createOrdersCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('orders');
  });

  // ─── Open orders display ──────────────────────────────────────
  it('calls searchOpenOrders and displays results table', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['orders', '--no-color'], { from: 'user' });

    expect(mockSearchOpenOrders).toHaveBeenCalledWith('test-jwt', 12345);
    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toContain('100');     // order id
    expect(stdoutOutput).toContain('BUY');     // side label (SAF-01)
    expect(stdoutOutput).toContain('Limit');   // type label (SAF-01)
    expect(stdoutOutput).toContain('Open');    // status label (SAF-01)
  });

  // ─── --all uses searchOrders ──────────────────────────────────
  it('calls searchOrders with 7-day window when --all is set', async () => {
    setupDefaults();
    mockSearchOrders.mockResolvedValue({
      orders: [],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['orders', '--all'], { from: 'user' });

    expect(mockSearchOrders).toHaveBeenCalledWith(
      'test-jwt',
      12345,
      expect.any(String),
    );
    expect(mockSearchOpenOrders).not.toHaveBeenCalled();
  });

  // ─── --symbol filters by contractId ───────────────────────────
  it('filters orders by resolved contractId when --symbol is set', async () => {
    setupDefaults();
    mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
    mockSearchOpenOrders.mockResolvedValue({
      orders: [
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
      ],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['orders', '--symbol', 'ES', '--no-color'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toContain('100');
    expect(stdoutOutput).not.toContain('200');
  });

  // ─── Empty results ──────────────────────────────────────────
  it('prints "No open orders." to stderr when no results', async () => {
    setupDefaults();
    mockSearchOpenOrders.mockResolvedValue({
      orders: [],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['orders'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('No open orders.');
  });

  it('prints "No orders found." for --all with no results', async () => {
    setupDefaults();
    mockSearchOrders.mockResolvedValue({
      orders: [],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['orders', '--all'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('No orders found.');
  });

  // ─── Labels used (SAF-01) ────────────────────────────────────
  it('displays enum labels not bare integers (SAF-01)', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['orders', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed[0].side).toBe('BUY');
    expect(parsed[0].type).toBe('Limit');
    expect(parsed[0].status).toBe('Open');
  });

  // ─── Null prices displayed as '--' ────────────────────────────
  it('displays null limitPrice/stopPrice as "--"', async () => {
    setupDefaults();
    mockSearchOpenOrders.mockResolvedValue({
      orders: [
        {
          id: 300,
          accountId: 12345,
          contractId: 'CON.F.US.EP.U25',
          creationTimestamp: '2026-03-14T10:00:00Z',
          updateTimestamp: '2026-03-14T10:00:00Z',
          status: OrderStatus.Open,
          type: OrderType.Market,
          side: OrderSide.Bid,
          size: 1,
          limitPrice: null,
          stopPrice: null,
          fillVolume: null,
          filledPrice: null,
          customTag: null,
        },
      ],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['orders', '--json'], { from: 'user' });

    const stdoutOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed[0].limitPrice).toBe('--');
    expect(parsed[0].stopPrice).toBe('--');
  });

  // ─── Auth check ─────────────────────────────────────────────
  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['orders'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });
});
