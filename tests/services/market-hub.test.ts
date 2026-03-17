import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Shared mock objects exposed for test assertions
const mockConnection = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  invoke: vi.fn().mockResolvedValue(undefined),
};

const mockBuilder = {
  withUrl: vi.fn().mockReturnThis(),
  configureLogging: vi.fn().mockReturnThis(),
  build: vi.fn().mockReturnValue(mockConnection),
};

// Mock @microsoft/signalr before importing the module under test
vi.mock('@microsoft/signalr', () => {
  // Use a class so `new HubConnectionBuilder()` works in vitest v4
  class MockHubConnectionBuilder {
    withUrl(...args: unknown[]) { return mockBuilder.withUrl(...args); }
    configureLogging(...args: unknown[]) { return mockBuilder.configureLogging(...args); }
    build(...args: unknown[]) { return mockBuilder.build(...args); }
  }

  return {
    HubConnectionBuilder: MockHubConnectionBuilder,
    HttpTransportType: { WebSockets: 1 },
    LogLevel: { Warning: 3 },
  };
});

import { createMarketHubConnection, fetchOneQuote } from '../../src/services/market-hub.js';
import * as signalr from '@microsoft/signalr';
import type { QuoteData } from '../../src/types/api.js';

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

describe('createMarketHubConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup the chainable mocks after clearing
    mockBuilder.withUrl.mockReturnThis();
    mockBuilder.configureLogging.mockReturnThis();
    mockBuilder.build.mockReturnValue(mockConnection);
  });

  it('creates a HubConnection with the correct Market Hub URL', () => {
    createMarketHubConnection('test-token');

    expect(mockBuilder.withUrl).toHaveBeenCalledWith(
      'https://rtc.topstepx.com/hubs/market',
      expect.objectContaining({
        skipNegotiation: true,
        transport: signalr.HttpTransportType.WebSockets,
      }),
    );
  });

  it('configures accessTokenFactory that returns the token', () => {
    createMarketHubConnection('my-jwt-token');

    const urlOptions = mockBuilder.withUrl.mock.calls[0][1];
    expect(urlOptions.accessTokenFactory()).toBe('my-jwt-token');
  });

  it('configures logging at Warning level', () => {
    createMarketHubConnection('test-token');

    expect(mockBuilder.configureLogging).toHaveBeenCalledWith(signalr.LogLevel.Warning);
  });

  it('returns the built HubConnection object', () => {
    const result = createMarketHubConnection('test-token');

    expect(mockBuilder.build).toHaveBeenCalled();
    expect(result).toBe(mockConnection);
  });
});

describe('fetchOneQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockConnection.start.mockResolvedValue(undefined);
    mockConnection.stop.mockResolvedValue(undefined);
    mockConnection.invoke.mockResolvedValue(undefined);
    mockConnection.on.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with QuoteData when GatewayQuote fires for matching contractId', async () => {
    mockConnection.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'GatewayQuote') {
        // Simulate receiving a quote shortly after subscription
        setTimeout(() => handler('CON.F.US.EP.U25', MOCK_QUOTE), 50);
      }
    });

    const quotePromise = fetchOneQuote(mockConnection as any, 'CON.F.US.EP.U25', 5000);
    await vi.advanceTimersByTimeAsync(100);
    const result = await quotePromise;

    expect(result).toEqual(MOCK_QUOTE);
    expect(mockConnection.invoke).toHaveBeenCalledWith('SubscribeContractQuotes', 'CON.F.US.EP.U25');
  });

  it('rejects with timeout error if no GatewayQuote arrives within timeout period', async () => {
    mockConnection.on.mockImplementation(() => {});

    const quotePromise = fetchOneQuote(mockConnection as any, 'CON.F.US.EP.U25', 500);

    // Attach the rejection handler BEFORE advancing timers to avoid unhandled rejection
    const assertionPromise = expect(quotePromise).rejects.toThrow('Timed out');
    await vi.advanceTimersByTimeAsync(600);
    await assertionPromise;
  });

  it('ignores GatewayQuote events for non-matching contractIds', async () => {
    mockConnection.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'GatewayQuote') {
        // Fire a non-matching contractId first, then a matching one
        setTimeout(() => handler('CON.F.US.ENQ.U25', { ...MOCK_QUOTE, symbol: 'NQU5' }), 50);
        setTimeout(() => handler('CON.F.US.EP.U25', MOCK_QUOTE), 100);
      }
    });

    const quotePromise = fetchOneQuote(mockConnection as any, 'CON.F.US.EP.U25', 5000);
    await vi.advanceTimersByTimeAsync(150);
    const result = await quotePromise;

    // Should have gotten the matching ES quote, not the NQ one
    expect(result.symbol).toBe('ESU5');
  });

  it('rejects when invoke fails', async () => {
    mockConnection.on.mockImplementation(() => {});
    mockConnection.invoke.mockRejectedValue(new Error('Invoke failed'));

    const quotePromise = fetchOneQuote(mockConnection as any, 'CON.F.US.EP.U25', 5000);

    await expect(quotePromise).rejects.toThrow('Invoke failed');
  });
});
