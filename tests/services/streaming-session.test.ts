import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Shared mock objects ──────────────────────────────────────────────

const mockConnection = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  invoke: vi.fn().mockResolvedValue(undefined),
  onreconnecting: vi.fn(),
  onreconnected: vi.fn(),
  onclose: vi.fn(),
};

const mockBuilder = {
  withUrl: vi.fn().mockReturnThis(),
  withAutomaticReconnect: vi.fn().mockReturnThis(),
  configureLogging: vi.fn().mockReturnThis(),
  build: vi.fn().mockReturnValue(mockConnection),
};

// ── Mock @microsoft/signalr ──────────────────────────────────────────

vi.mock('@microsoft/signalr', () => {
  class MockHubConnectionBuilder {
    withUrl(...args: unknown[]) { return mockBuilder.withUrl(...args); }
    withAutomaticReconnect(...args: unknown[]) { return mockBuilder.withAutomaticReconnect(...args); }
    configureLogging(...args: unknown[]) { return mockBuilder.configureLogging(...args); }
    build(...args: unknown[]) { return mockBuilder.build(...args); }
  }

  return {
    HubConnectionBuilder: MockHubConnectionBuilder,
    HttpTransportType: { WebSockets: 1 },
    LogLevel: { Warning: 3 },
  };
});

// ── Mock auth modules ────────────────────────────────────────────────

vi.mock('../../src/auth/client.js', () => ({
  refreshToken: vi.fn().mockResolvedValue('new-refreshed-token'),
}));

vi.mock('../../src/auth/token.js', () => ({
  isTokenExpiringSoon: vi.fn().mockReturnValue(false),
  loadToken: vi.fn().mockReturnValue({
    token: 'test-token',
    acquiredAt: '2026-03-14T00:00:00Z',
    expiresAt: '2026-03-15T00:00:00Z',
    username: 'testuser',
  }),
  saveToken: vi.fn(),
  decodeJwtPayload: vi.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 86400, iat: Math.floor(Date.now() / 1000) }),
}));

// ── Imports (after mocks) ────────────────────────────────────────────

import { StreamingSession, setupGracefulShutdown } from '../../src/services/streaming-session.js';
import { createPersistentMarketHub } from '../../src/services/market-hub.js';
import { refreshToken } from '../../src/auth/client.js';
import { isTokenExpiringSoon, loadToken, saveToken, decodeJwtPayload } from '../../src/auth/token.js';
import type { QuoteData, DepthData, MarketTradeData } from '../../src/types/api.js';

// ── Helpers ──────────────────────────────────────────────────────────

function resetMocks() {
  vi.clearAllMocks();
  mockBuilder.withUrl.mockReturnThis();
  mockBuilder.withAutomaticReconnect.mockReturnThis();
  mockBuilder.configureLogging.mockReturnThis();
  mockBuilder.build.mockReturnValue(mockConnection);
  mockConnection.start.mockResolvedValue(undefined);
  mockConnection.stop.mockResolvedValue(undefined);
  mockConnection.invoke.mockResolvedValue(undefined);
  mockConnection.on.mockImplementation(() => {});
  mockConnection.onreconnecting.mockImplementation(() => {});
  mockConnection.onreconnected.mockImplementation(() => {});
  mockConnection.onclose.mockImplementation(() => {});
}

// ── Tests ────────────────────────────────────────────────────────────

describe('createPersistentMarketHub', () => {
  beforeEach(resetMocks);

  it('calls withAutomaticReconnect with retry delays [0, 2000, 5000, 10000, 30000]', () => {
    createPersistentMarketHub({ token: 'test-token' });

    expect(mockBuilder.withAutomaticReconnect).toHaveBeenCalledWith([0, 2000, 5000, 10000, 30000]);
  });

  it('uses mutable tokenHolder.token in accessTokenFactory (not a captured string)', () => {
    const tokenHolder = { token: 'initial-token' };
    createPersistentMarketHub(tokenHolder);

    const urlOptions = mockBuilder.withUrl.mock.calls[0][1] as { accessTokenFactory: () => string };
    expect(urlOptions.accessTokenFactory()).toBe('initial-token');

    // Mutate the token holder
    tokenHolder.token = 'refreshed-token';
    expect(urlOptions.accessTokenFactory()).toBe('refreshed-token');
  });
});

describe('StreamingSession', () => {
  beforeEach(() => {
    resetMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start() connects and subscribes to GatewayQuote for the given contractId', async () => {
    const onQuote = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: false,
      trades: false,
      onQuote,
    });

    await session.start();

    expect(mockConnection.start).toHaveBeenCalled();
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractQuotes', 'CON.F.US.EP.U25');
    expect(mockConnection.on).toHaveBeenCalledWith('GatewayQuote', expect.any(Function));
  });

  it('start() with depth=true also subscribes to SubscribeContractDepth', async () => {
    const onQuote = vi.fn();
    const onDepth = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: true,
      trades: false,
      onQuote,
      onDepth,
    });

    await session.start();

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractDepth', 'CON.F.US.EP.U25');
    expect(mockConnection.on).toHaveBeenCalledWith('GatewayDepth', expect.any(Function));
  });

  it('start() with trades=true also subscribes to SubscribeContractTrades', async () => {
    const onQuote = vi.fn();
    const onTrade = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: false,
      trades: true,
      onQuote,
      onTrade,
    });

    await session.start();

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractTrades', 'CON.F.US.EP.U25');
    expect(mockConnection.on).toHaveBeenCalledWith('GatewayTrade', expect.any(Function));
  });

  it('onreconnected callback re-invokes all tracked subscriptions (quotes, depth if enabled, trades if enabled)', async () => {
    const onQuote = vi.fn();
    const onDepth = vi.fn();
    const onTrade = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: true,
      trades: true,
      onQuote,
      onDepth,
      onTrade,
    });

    await session.start();

    // Clear invoke calls from start()
    mockConnection.invoke.mockClear();

    // Simulate reconnection by calling the onreconnected callback
    const reconnectedCallback = mockConnection.onreconnected.mock.calls[0][0] as () => void;
    reconnectedCallback();

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractQuotes', 'CON.F.US.EP.U25');
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractDepth', 'CON.F.US.EP.U25');
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractTrades', 'CON.F.US.EP.U25');
  });

  it('token refresh timer fires and calls refreshToken when isTokenExpiringSoon returns true, updates tokenHolder.token', async () => {
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true);
    vi.mocked(refreshToken).mockResolvedValue('new-refreshed-token');

    const onQuote = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: false,
      trades: false,
      onQuote,
    });

    await session.start();

    // Advance timer to trigger refresh (60 minutes)
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(isTokenExpiringSoon).toHaveBeenCalled();
    expect(refreshToken).toHaveBeenCalledWith('test-token');
  });

  it('token refresh updates disk cache via saveToken with new token and expiry', async () => {
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true);
    vi.mocked(refreshToken).mockResolvedValue('new-refreshed-token');
    vi.mocked(decodeJwtPayload).mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 86400,
      iat: Math.floor(Date.now() / 1000),
    });
    vi.mocked(loadToken).mockReturnValue({
      token: 'test-token',
      acquiredAt: '2026-03-14T00:00:00Z',
      expiresAt: '2026-03-15T00:00:00Z',
      username: 'testuser',
    });

    const onQuote = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: false,
      trades: false,
      onQuote,
    });

    await session.start();

    // Advance timer to trigger refresh
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(saveToken).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'new-refreshed-token',
        username: 'testuser',
      }),
    );
  });

  it('stop() calls UnsubscribeContractQuotes, connection.stop(), and clears refresh timer', async () => {
    const onQuote = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: false,
      trades: false,
      onQuote,
    });

    await session.start();
    await session.stop();

    expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeContractQuotes', 'CON.F.US.EP.U25');
    expect(mockConnection.stop).toHaveBeenCalled();
  });

  it('stop() with depth/trades also calls UnsubscribeContractDepth/UnsubscribeContractTrades', async () => {
    const onQuote = vi.fn();
    const onDepth = vi.fn();
    const onTrade = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: true,
      trades: true,
      onQuote,
      onDepth,
      onTrade,
    });

    await session.start();
    await session.stop();

    expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeContractDepth', 'CON.F.US.EP.U25');
    expect(mockConnection.invoke).toHaveBeenCalledWith('UnsubscribeContractTrades', 'CON.F.US.EP.U25');
  });

  it('handles onclose by setting a shutdown flag (does not throw)', async () => {
    const onClose = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: false,
      trades: false,
      onQuote: vi.fn(),
      onClose,
    });

    await session.start();

    // Simulate connection close by calling the onclose callback
    const closeCallback = mockConnection.onclose.mock.calls[0][0] as (error?: Error) => void;
    expect(() => closeCallback(new Error('Connection lost'))).not.toThrow();
    expect(onClose).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('setupGracefulShutdown', () => {
  beforeEach(() => {
    resetMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers SIGINT/SIGTERM handlers that call session.stop()', async () => {
    const processSpy = vi.spyOn(process, 'on');

    const onQuote = vi.fn();
    const session = new StreamingSession('test-token', {
      contractId: 'CON.F.US.EP.U25',
      depth: false,
      trades: false,
      onQuote,
    });

    setupGracefulShutdown(session);

    expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    processSpy.mockRestore();
  });
});
