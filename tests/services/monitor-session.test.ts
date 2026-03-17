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

// ── Mock user-hub ────────────────────────────────────────────────────

vi.mock('../../src/services/user-hub.js', () => ({
  createPersistentUserHub: vi.fn(),
}));

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

import { MonitorSession } from '../../src/services/monitor-session.js';
import { createPersistentUserHub } from '../../src/services/user-hub.js';
import { refreshToken } from '../../src/auth/client.js';
import { isTokenExpiringSoon, loadToken, saveToken, decodeJwtPayload } from '../../src/auth/token.js';
import type { Order, Position, Trade, Account } from '../../src/types/api.js';

// ── Helpers ──────────────────────────────────────────────────────────

function resetMocks() {
  vi.clearAllMocks();
  mockConnection.start.mockResolvedValue(undefined);
  mockConnection.stop.mockResolvedValue(undefined);
  mockConnection.invoke.mockResolvedValue(undefined);
  mockConnection.on.mockImplementation(() => {});
  mockConnection.onreconnecting.mockImplementation(() => {});
  mockConnection.onreconnected.mockImplementation(() => {});
  mockConnection.onclose.mockImplementation(() => {});
  vi.mocked(createPersistentUserHub).mockReturnValue(mockConnection as any);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('MonitorSession', () => {
  beforeEach(() => {
    resetMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start() calls createPersistentUserHub with a tokenHolder containing the token', async () => {
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    expect(createPersistentUserHub).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'test-token' }),
    );
  });

  it('start() registers all 4 event handlers and subscribes to all channels when no filters set', async () => {
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    // Check all 4 handlers registered
    const onCalls = mockConnection.on.mock.calls.map((c: any[]) => c[0]);
    expect(onCalls).toContain('GatewayUserOrder');
    expect(onCalls).toContain('GatewayUserPosition');
    expect(onCalls).toContain('GatewayUserTrade');
    expect(onCalls).toContain('GatewayUserAccount');

    // Check all subscriptions
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeOrders', 12345);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribePositions', 12345);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeTrades', 12345);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeAccounts');
  });

  it('start() with ordersOnly=true only subscribes to SubscribeOrders and registers GatewayUserOrder', async () => {
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: true,
      positionsOnly: false,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    const onCalls = mockConnection.on.mock.calls.map((c: any[]) => c[0]);
    expect(onCalls).toContain('GatewayUserOrder');
    expect(onCalls).not.toContain('GatewayUserPosition');
    expect(onCalls).not.toContain('GatewayUserTrade');
    expect(onCalls).not.toContain('GatewayUserAccount');

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeOrders', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribePositions', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeTrades', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeAccounts');
  });

  it('start() with positionsOnly=true only subscribes to SubscribePositions and registers GatewayUserPosition', async () => {
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: true,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    const onCalls = mockConnection.on.mock.calls.map((c: any[]) => c[0]);
    expect(onCalls).toContain('GatewayUserPosition');
    expect(onCalls).not.toContain('GatewayUserOrder');
    expect(onCalls).not.toContain('GatewayUserTrade');
    expect(onCalls).not.toContain('GatewayUserAccount');

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribePositions', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeOrders', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeTrades', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeAccounts');
  });

  it('start() with tradesOnly=true only subscribes to SubscribeTrades and registers GatewayUserTrade', async () => {
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: true,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    const onCalls = mockConnection.on.mock.calls.map((c: any[]) => c[0]);
    expect(onCalls).toContain('GatewayUserTrade');
    expect(onCalls).not.toContain('GatewayUserOrder');
    expect(onCalls).not.toContain('GatewayUserPosition');
    expect(onCalls).not.toContain('GatewayUserAccount');

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeTrades', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeOrders', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribePositions', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeAccounts');
  });

  it('start() with multiple filters subscribes to those channels only', async () => {
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: true,
      positionsOnly: false,
      tradesOnly: true,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    const onCalls = mockConnection.on.mock.calls.map((c: any[]) => c[0]);
    expect(onCalls).toContain('GatewayUserOrder');
    expect(onCalls).toContain('GatewayUserTrade');
    expect(onCalls).not.toContain('GatewayUserPosition');
    expect(onCalls).not.toContain('GatewayUserAccount');

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeOrders', 12345);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeTrades', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribePositions', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeAccounts');
  });

  it('onreconnected re-invokes all active Subscribe methods', async () => {
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    // Clear invoke calls from start()
    mockConnection.invoke.mockClear();

    // Simulate reconnection
    const reconnectedCallback = mockConnection.onreconnected.mock.calls[0][0] as () => void;
    reconnectedCallback();

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeOrders', 12345);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribePositions', 12345);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeTrades', 12345);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeAccounts');
  });

  it('onreconnected with ordersOnly=true only re-subscribes to SubscribeOrders', async () => {
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: true,
      positionsOnly: false,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();
    mockConnection.invoke.mockClear();

    const reconnectedCallback = mockConnection.onreconnected.mock.calls[0][0] as () => void;
    reconnectedCallback();

    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeOrders', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribePositions', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeTrades', 12345);
    expect(mockConnection.invoke).not.toHaveBeenCalledWith('SubscribeAccounts');
  });

  it('stop() calls Unsubscribe methods and connection.stop(), never throws on error', async () => {
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    // Make invoke fail to test that stop() never throws
    mockConnection.invoke.mockRejectedValue(new Error('unsubscribe failed'));
    mockConnection.stop.mockRejectedValue(new Error('stop failed'));

    await expect(session.stop()).resolves.not.toThrow();
    expect(mockConnection.stop).toHaveBeenCalled();
  });

  it('token refresh timer fires and calls refreshToken when isTokenExpiringSoon returns true', async () => {
    vi.mocked(isTokenExpiringSoon).mockReturnValue(true);
    vi.mocked(refreshToken).mockResolvedValue('new-refreshed-token');

    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    // Advance timer to trigger refresh (60 minutes)
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(isTokenExpiringSoon).toHaveBeenCalled();
    expect(refreshToken).toHaveBeenCalledWith('test-token');
  });

  it('token refresh updates disk cache via saveToken with new token', async () => {
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

    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
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

  it('event handler for GatewayUserOrder calls onOrder callback with data', async () => {
    const onOrder = vi.fn();
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: false,
      onOrder,
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
    });

    await session.start();

    // Find the GatewayUserOrder handler
    const orderHandler = mockConnection.on.mock.calls.find(
      (c: any[]) => c[0] === 'GatewayUserOrder',
    )?.[1] as (data: Order) => void;

    expect(orderHandler).toBeDefined();

    const mockOrder: Order = {
      id: 1,
      accountId: 12345,
      contractId: 'CON.F.US.EP.U25',
      creationTimestamp: '2026-03-14T16:00:00Z',
      updateTimestamp: '2026-03-14T16:00:00Z',
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

    orderHandler(mockOrder);
    expect(onOrder).toHaveBeenCalledWith(mockOrder);
  });

  it('handles onclose by calling onClose callback without throwing', async () => {
    const onClose = vi.fn();
    const session = new MonitorSession('test-token', {
      accountId: 12345,
      ordersOnly: false,
      positionsOnly: false,
      tradesOnly: false,
      onOrder: vi.fn(),
      onPosition: vi.fn(),
      onTrade: vi.fn(),
      onAccount: vi.fn(),
      onClose,
    });

    await session.start();

    const closeCallback = mockConnection.onclose.mock.calls[0][0] as (error?: Error) => void;
    expect(() => closeCallback(new Error('Connection lost'))).not.toThrow();
    expect(onClose).toHaveBeenCalledWith(expect.any(Error));
  });
});
