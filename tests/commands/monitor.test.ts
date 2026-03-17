import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock modules before imports -- vi.mock is hoisted
vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

vi.mock('../../src/services/account-resolver.js', () => ({
  resolveAccountId: vi.fn(),
}));

vi.mock('../../src/services/monitor-session.js', () => {
  const SessionMock = vi.fn(function (this: any) {
    return SessionMock._instance;
  }) as any;
  SessionMock._instance = null;
  return {
    MonitorSession: SessionMock,
  };
});

vi.mock('../../src/services/event-formatter.js', () => ({
  renderOrderEvent: vi.fn(),
  renderPositionEvent: vi.fn(),
  renderTradeEvent: vi.fn(),
  renderAccountEvent: vi.fn(),
}));

vi.mock('../../src/services/terminal-renderer.js', () => ({
  emitJsonEvent: vi.fn(),
}));

vi.mock('../../src/output/index.js', () => ({
  verbose: vi.fn(),
}));

import { createMonitorCommand } from '../../src/commands/monitor.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveAccountId } from '../../src/services/account-resolver.js';
import { MonitorSession } from '../../src/services/monitor-session.js';
import type { MonitorOptions } from '../../src/services/monitor-session.js';
import {
  renderOrderEvent,
  renderPositionEvent,
  renderTradeEvent,
  renderAccountEvent,
} from '../../src/services/event-formatter.js';
import { emitJsonEvent } from '../../src/services/terminal-renderer.js';
import { AuthError } from '../../src/errors/index.js';
import type { Order, Position, Trade, Account } from '../../src/types/api.js';

const mockLoadToken = vi.mocked(loadToken);
const mockResolveAccountId = vi.mocked(resolveAccountId);
const MockMonitorSession = vi.mocked(MonitorSession);
const mockRenderOrderEvent = vi.mocked(renderOrderEvent);
const mockRenderPositionEvent = vi.mocked(renderPositionEvent);
const mockRenderTradeEvent = vi.mocked(renderTradeEvent);
const mockRenderAccountEvent = vi.mocked(renderAccountEvent);
const mockEmitJsonEvent = vi.mocked(emitJsonEvent);

// Use a sentinel error to break out of the never-resolving promise in the action handler
class TestExitError extends Error {
  constructor() {
    super('test-exit');
    Object.setPrototypeOf(this, TestExitError.prototype);
  }
}

// Mock session instance
function createMockSession() {
  return {
    start: vi.fn().mockRejectedValue(new TestExitError()),
    stop: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Test Data ────────────────────────────────────────────────────────

const MOCK_ORDER: Order = {
  id: 100,
  accountId: 12345,
  contractId: 'CON.F.US.EP.U25',
  creationTimestamp: '2026-03-14T16:30:00Z',
  updateTimestamp: '2026-03-14T16:30:01Z',
  status: 2,
  type: 2,
  side: 0,
  size: 1,
  limitPrice: null,
  stopPrice: null,
  fillVolume: 1,
  filledPrice: 5425.50,
  customTag: null,
};

const MOCK_POSITION: Position = {
  id: 200,
  accountId: 12345,
  contractId: 'CON.F.US.EP.U25',
  creationTimestamp: '2026-03-14T16:30:00Z',
  type: 1,
  size: 2,
  averagePrice: 5425.25,
};

const MOCK_TRADE: Trade = {
  id: 300,
  accountId: 12345,
  contractId: 'CON.F.US.EP.U25',
  creationTimestamp: '2026-03-14T16:30:00Z',
  price: 5425.50,
  profitAndLoss: 125.00,
  fees: 2.50,
  side: 0,
  size: 1,
  voided: false,
  orderId: 100,
};

const MOCK_ACCOUNT: Account = {
  id: 12345,
  name: 'Combine Account 1',
  balance: 50000.00,
  canTrade: true,
};

/** Helper to create a parent program with global options and run monitor command */
async function runMonitor(args: string[]): Promise<MonitorOptions> {
  const cmd = createMonitorCommand();
  const program = new Command();
  program
    .option('--json', 'JSON output')
    .option('--no-color', 'No color')
    .option('--verbose', 'Verbose')
    .option('--account <id>', 'Account ID');
  program.addCommand(cmd);

  try {
    await program.parseAsync(['monitor', ...args], { from: 'user' });
  } catch (err) {
    if (!(err instanceof TestExitError)) {
      throw err;
    }
  }

  // Return the MonitorOptions that were passed to the constructor
  if (MockMonitorSession.mock.calls.length > 0) {
    return MockMonitorSession.mock.calls[0][1] as MonitorOptions;
  }
  throw new Error('MonitorSession constructor was not called');
}

describe('monitorCommand', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let mockSession: ReturnType<typeof createMockSession>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mockSession = createMockSession();

    // Default: authenticated with valid token
    mockLoadToken.mockReturnValue({
      token: 'test-jwt',
      acquiredAt: '',
      expiresAt: '',
      username: 'user1',
    });
    mockResolveAccountId.mockResolvedValue(12345);

    // Set class instance mock via the _instance property
    (MonitorSession as any)._instance = mockSession;
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it('createMonitorCommand returns a Command named "monitor"', () => {
    const cmd = createMonitorCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('monitor');
  });

  it('has --orders-only, --positions-only, --trades-only options', () => {
    const cmd = createMonitorCommand();
    const ordersOnly = cmd.options.find((o) => o.long === '--orders-only');
    const positionsOnly = cmd.options.find((o) => o.long === '--positions-only');
    const tradesOnly = cmd.options.find((o) => o.long === '--trades-only');
    expect(ordersOnly).toBeDefined();
    expect(positionsOnly).toBeDefined();
    expect(tradesOnly).toBeDefined();
  });

  it('throws AuthError when not authenticated (loadToken returns null)', async () => {
    mockLoadToken.mockReturnValue(null);

    const cmd = createMonitorCommand();
    const program = new Command();
    program.option('--json', 'JSON output').option('--no-color', 'No color').option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await expect(
      program.parseAsync(['monitor'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });

  it('calls resolveAccountId with globals and token', async () => {
    await runMonitor([]);

    expect(mockResolveAccountId).toHaveBeenCalledWith(
      expect.any(Object),
      'test-jwt',
    );
  });

  it('creates MonitorSession with correct accountId and default filter flags', async () => {
    await runMonitor([]);

    expect(MockMonitorSession).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: false,
    }));
  });

  it('ordersOnly=true when --orders-only flag set', async () => {
    const options = await runMonitor(['--orders-only']);

    expect(options.ordersOnly).toBe(true);
    expect(options.positionsOnly).toBe(false);
    expect(options.tradesOnly).toBe(false);
  });

  it('positionsOnly=true when --positions-only flag set', async () => {
    const options = await runMonitor(['--positions-only']);

    expect(options.positionsOnly).toBe(true);
    expect(options.ordersOnly).toBe(false);
    expect(options.tradesOnly).toBe(false);
  });

  it('tradesOnly=true when --trades-only flag set', async () => {
    const options = await runMonitor(['--trades-only']);

    expect(options.tradesOnly).toBe(true);
    expect(options.ordersOnly).toBe(false);
    expect(options.positionsOnly).toBe(false);
  });

  it('calls session.start() to begin monitoring', async () => {
    await runMonitor([]);

    expect(mockSession.start).toHaveBeenCalled();
  });

  it('onOrder callback calls renderOrderEvent in non-JSON mode', async () => {
    const options = await runMonitor([]);

    options.onOrder(MOCK_ORDER);

    expect(mockRenderOrderEvent).toHaveBeenCalledWith(MOCK_ORDER);
  });

  it('onOrder callback calls emitJsonEvent("order", data) in --json mode', async () => {
    const options = await runMonitor(['--json']);

    options.onOrder(MOCK_ORDER);

    expect(mockEmitJsonEvent).toHaveBeenCalledWith('order', MOCK_ORDER);
    expect(mockRenderOrderEvent).not.toHaveBeenCalled();
  });

  it('onTrade callback calls renderTradeEvent in non-JSON mode', async () => {
    const options = await runMonitor([]);

    options.onTrade(MOCK_TRADE);

    expect(mockRenderTradeEvent).toHaveBeenCalledWith(MOCK_TRADE);
  });

  it('onTrade callback calls emitJsonEvent("trade", data) in --json mode', async () => {
    const options = await runMonitor(['--json']);

    options.onTrade(MOCK_TRADE);

    expect(mockEmitJsonEvent).toHaveBeenCalledWith('trade', MOCK_TRADE);
    expect(mockRenderTradeEvent).not.toHaveBeenCalled();
  });

  it('onPosition callback calls renderPositionEvent in non-JSON mode', async () => {
    const options = await runMonitor([]);

    options.onPosition(MOCK_POSITION);

    expect(mockRenderPositionEvent).toHaveBeenCalledWith(MOCK_POSITION);
  });

  it('onAccount callback calls renderAccountEvent in non-JSON mode', async () => {
    const options = await runMonitor([]);

    options.onAccount(MOCK_ACCOUNT);

    expect(mockRenderAccountEvent).toHaveBeenCalledWith(MOCK_ACCOUNT);
  });

  it('onAccount callback calls emitJsonEvent("account", data) in --json mode', async () => {
    const options = await runMonitor(['--json']);

    options.onAccount(MOCK_ACCOUNT);

    expect(mockEmitJsonEvent).toHaveBeenCalledWith('account', MOCK_ACCOUNT);
    expect(mockRenderAccountEvent).not.toHaveBeenCalled();
  });

  it('prints monitoring header in non-JSON mode', async () => {
    await runMonitor([]);

    const stdoutOutput = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toContain('Monitoring');
    expect(stdoutOutput).toContain('12345');
  });

  it('does not print monitoring header in JSON mode', async () => {
    await runMonitor(['--json']);

    const stdoutOutput = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).not.toContain('Monitoring');
  });
});
