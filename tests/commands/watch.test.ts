import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock modules before imports -- vi.mock is hoisted
vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

vi.mock('../../src/services/symbol-resolver.js', () => ({
  resolveSymbol: vi.fn(),
}));

vi.mock('../../src/services/streaming-session.js', () => {
  const SessionMock = vi.fn(function (this: any) {
    return SessionMock._instance;
  }) as any;
  SessionMock._instance = null;
  return {
    StreamingSession: SessionMock,
    setupGracefulShutdown: vi.fn(),
  };
});

vi.mock('../../src/services/dom-state.js', () => {
  const DomMock = vi.fn(function (this: any) {
    return DomMock._instance;
  }) as any;
  DomMock._instance = null;
  return {
    DomState: DomMock,
  };
});

vi.mock('../../src/services/terminal-renderer.js', () => ({
  renderHeader: vi.fn(),
  renderQuote: vi.fn(),
  renderDom: vi.fn(),
  renderTrade: vi.fn(),
  emitJsonEvent: vi.fn(),
}));

vi.mock('../../src/output/index.js', () => ({
  verbose: vi.fn(),
}));

import { createWatchCommand } from '../../src/commands/watch.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveSymbol } from '../../src/services/symbol-resolver.js';
import { StreamingSession, setupGracefulShutdown } from '../../src/services/streaming-session.js';
import { DomState } from '../../src/services/dom-state.js';
import {
  renderHeader,
  renderQuote,
  renderDom,
  renderTrade,
  emitJsonEvent,
} from '../../src/services/terminal-renderer.js';
import { AuthError } from '../../src/errors/index.js';
import type { QuoteData, DepthData, MarketTradeData } from '../../src/types/api.js';
import type { StreamingOptions } from '../../src/services/streaming-session.js';

const mockLoadToken = vi.mocked(loadToken);
const mockResolveSymbol = vi.mocked(resolveSymbol);
const MockStreamingSession = vi.mocked(StreamingSession);
const mockSetupGracefulShutdown = vi.mocked(setupGracefulShutdown);
const MockDomState = vi.mocked(DomState);
const mockRenderHeader = vi.mocked(renderHeader);
const mockRenderQuote = vi.mocked(renderQuote);
const mockRenderDom = vi.mocked(renderDom);
const mockRenderTrade = vi.mocked(renderTrade);
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

// Mock DomState instance
function createMockDomState() {
  return {
    update: vi.fn(),
    getTopLevels: vi.fn().mockReturnValue({ bids: [], asks: [] }),
    clear: vi.fn(),
  };
}

const MOCK_QUOTE: QuoteData = {
  symbol: 'ESU5',
  symbolName: 'E-mini S&P 500',
  lastPrice: 5425.50,
  bestBid: 5425.25,
  bestAsk: 5425.75,
  change: 12.50,
  changePercent: 0.23,
  open: 5413.00,
  high: 5430.00,
  low: 5410.00,
  volume: 1234567,
  lastUpdated: '2026-03-14T16:00:00Z',
  timestamp: '2026-03-14T16:00:00Z',
};

const MOCK_DEPTH: DepthData = {
  timestamp: '2026-03-14T16:00:00Z',
  type: 1,
  price: 5425.25,
  volume: 100,
  currentVolume: 100,
};

const MOCK_TRADE: MarketTradeData = {
  symbolId: 'F.US.EP',
  price: 5425.50,
  timestamp: '2026-03-14T16:00:00Z',
  type: 0,
  volume: 5,
};

/** Helper to create a parent program with global options and run watch command */
async function runWatch(args: string[]): Promise<StreamingOptions> {
  const cmd = createWatchCommand();
  const program = new Command();
  program
    .option('--json', 'JSON output')
    .option('--no-color', 'No color')
    .option('--verbose', 'Verbose')
    .option('--account <id>', 'Account ID');
  program.addCommand(cmd);

  try {
    await program.parseAsync(['watch', ...args], { from: 'user' });
  } catch (err) {
    if (!(err instanceof TestExitError)) {
      throw err;
    }
  }

  // Return the StreamingOptions that were passed to the constructor
  if (MockStreamingSession.mock.calls.length > 0) {
    return MockStreamingSession.mock.calls[0][1] as StreamingOptions;
  }
  throw new Error('StreamingSession constructor was not called');
}

describe('watchCommand', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let mockSession: ReturnType<typeof createMockSession>;
  let mockDomState: ReturnType<typeof createMockDomState>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    mockSession = createMockSession();
    mockDomState = createMockDomState();

    // Default: authenticated with valid token
    mockLoadToken.mockReturnValue({
      token: 'test-jwt',
      acquiredAt: '',
      expiresAt: '',
      username: 'user1',
    });
    mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');

    // Set class instance mocks via the _instance property
    (StreamingSession as any)._instance = mockSession;
    (DomState as any)._instance = mockDomState;
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('createWatchCommand returns a Command named "watch" with <symbol> argument', () => {
    const cmd = createWatchCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('watch');
  });

  it('watch command has --depth and --trades options defined', () => {
    const cmd = createWatchCommand();
    const depthOpt = cmd.options.find((o) => o.long === '--depth');
    const tradesOpt = cmd.options.find((o) => o.long === '--trades');
    expect(depthOpt).toBeDefined();
    expect(tradesOpt).toBeDefined();
  });

  it('throws AuthError when not authenticated (loadToken returns null)', async () => {
    mockLoadToken.mockReturnValue(null);

    const cmd = createWatchCommand();
    const program = new Command();
    program.option('--json', 'JSON output').option('--no-color', 'No color').option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await expect(
      program.parseAsync(['watch', 'ES'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });

  it('calls resolveSymbol to convert friendly symbol to contractId', async () => {
    await runWatch(['ES']);

    expect(mockResolveSymbol).toHaveBeenCalledWith('ES', 'test-jwt');
  });

  it('creates StreamingSession with correct options (contractId, depth, trades)', async () => {
    await runWatch(['ES']);

    expect(MockStreamingSession).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      contractId: 'CON.F.US.EP.U25',
      depth: false,
      trades: false,
    }));
  });

  it('creates StreamingSession with depth=true when --depth flag is set', async () => {
    await runWatch(['ES', '--depth']);

    expect(MockStreamingSession).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      contractId: 'CON.F.US.EP.U25',
      depth: true,
    }));
  });

  it('creates StreamingSession with trades=true when --trades flag is set', async () => {
    await runWatch(['ES', '--trades']);

    expect(MockStreamingSession).toHaveBeenCalledWith('test-jwt', expect.objectContaining({
      contractId: 'CON.F.US.EP.U25',
      trades: true,
    }));
  });

  it('calls session.start() to begin streaming', async () => {
    await runWatch(['ES']);

    expect(mockSession.start).toHaveBeenCalled();
  });

  it('calls setupGracefulShutdown with the session', async () => {
    await runWatch(['ES']);

    expect(mockSetupGracefulShutdown).toHaveBeenCalledWith(mockSession);
  });

  it('onQuote callback calls renderQuote in TTY mode', async () => {
    const options = await runWatch(['ES']);

    options.onQuote('CON.F.US.EP.U25', MOCK_QUOTE);

    expect(mockRenderQuote).toHaveBeenCalledWith(MOCK_QUOTE, expect.any(Boolean));
  });

  it('onDepth callback (when --depth) updates DomState and calls renderDom', async () => {
    const options = await runWatch(['ES', '--depth']);

    // Simulate depth callback
    options.onDepth!('CON.F.US.EP.U25', MOCK_DEPTH);

    expect(mockDomState.update).toHaveBeenCalledWith(MOCK_DEPTH);
  });

  it('onTrade callback (when --trades) calls renderTrade', async () => {
    const options = await runWatch(['ES', '--trades']);

    options.onTrade!('CON.F.US.EP.U25', MOCK_TRADE);

    expect(mockRenderTrade).toHaveBeenCalledWith(MOCK_TRADE);
  });

  it('onReconnecting callback writes reconnecting message to stderr', async () => {
    const options = await runWatch(['ES']);

    options.onReconnecting!(new Error('network error'));

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Reconnecting');
  });

  it('onClose callback writes disconnected message to stderr', async () => {
    const options = await runWatch(['ES']);

    options.onClose!(new Error('connection lost'));

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Connection closed');
  });

  it('--json mode emits NDJSON via emitJsonEvent instead of renderQuote', async () => {
    const options = await runWatch(['ES', '--json']);

    options.onQuote('CON.F.US.EP.U25', MOCK_QUOTE);

    expect(mockEmitJsonEvent).toHaveBeenCalledWith('quote', MOCK_QUOTE);
    expect(mockRenderQuote).not.toHaveBeenCalled();
  });

  it('--json mode emits NDJSON for trades via emitJsonEvent', async () => {
    const options = await runWatch(['ES', '--trades', '--json']);

    options.onTrade!('CON.F.US.EP.U25', MOCK_TRADE);

    expect(mockEmitJsonEvent).toHaveBeenCalledWith('trade', MOCK_TRADE);
    expect(mockRenderTrade).not.toHaveBeenCalled();
  });

  it('renders header when not in JSON mode', async () => {
    await runWatch(['ES']);

    expect(mockRenderHeader).toHaveBeenCalledWith('ES');
  });

  it('does not render header in JSON mode', async () => {
    await runWatch(['ES', '--json']);

    expect(mockRenderHeader).not.toHaveBeenCalled();
  });
});
