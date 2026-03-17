import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as readline from 'node:readline';
import { renderHeader, renderQuote, renderDom, renderTrade, emitJsonEvent } from '../../src/services/terminal-renderer.js';
import { TradeLogType } from '../../src/types/enums.js';
import type { QuoteData, MarketTradeData } from '../../src/types/api.js';
import type { DomLevel } from '../../src/services/dom-state.js';

// Mock readline cursor control functions
vi.mock('node:readline', () => ({
  cursorTo: vi.fn(),
  clearScreenDown: vi.fn(),
}));

function makeQuote(overrides: Partial<QuoteData> = {}): QuoteData {
  return {
    symbol: 'CON.F.US.EP.H26',
    symbolName: 'ESH6',
    lastPrice: 5425.50,
    bestBid: 5425.25,
    bestAsk: 5425.75,
    change: 12.50,
    changePercent: 0.23,
    open: 5413.00,
    high: 5430.00,
    low: 5410.00,
    volume: 1234567,
    lastUpdated: '2026-03-14T14:30:15Z',
    timestamp: '2026-03-14T14:30:15Z',
    ...overrides,
  };
}

function makeTrade(overrides: Partial<MarketTradeData> = {}): MarketTradeData {
  return {
    symbolId: 'F.US.EP',
    price: 5425.50,
    timestamp: '2026-03-14T14:30:15Z',
    type: TradeLogType.Buy,
    volume: 5,
    ...overrides,
  };
}

function createMockStream(): { write: ReturnType<typeof vi.fn> } {
  return { write: vi.fn() };
}

describe('terminal-renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renderHeader', () => {
    it('writes symbol name header line to provided stream', () => {
      const stream = createMockStream();
      renderHeader('ESH6', stream as unknown as NodeJS.WriteStream);
      expect(stream.write).toHaveBeenCalledTimes(1);
      const output = stream.write.mock.calls[0][0] as string;
      expect(output).toContain('ESH6');
      expect(output).toContain('\n');
    });
  });

  describe('renderQuote', () => {
    it('on TTY stream calls cursorTo(0) and clearScreenDown before writing', () => {
      const stream = createMockStream();
      renderQuote(makeQuote(), true, stream as unknown as NodeJS.WriteStream);
      expect(readline.cursorTo).toHaveBeenCalledWith(stream, 0);
      expect(readline.clearScreenDown).toHaveBeenCalledWith(stream);
      expect(stream.write).toHaveBeenCalled();
    });

    it('on non-TTY stream writes newline-terminated output without cursor control', () => {
      const stream = createMockStream();
      renderQuote(makeQuote(), false, stream as unknown as NodeJS.WriteStream);
      expect(readline.cursorTo).not.toHaveBeenCalled();
      expect(readline.clearScreenDown).not.toHaveBeenCalled();
      expect(stream.write).toHaveBeenCalled();
      // Non-TTY output should end with a newline
      const allOutput = stream.write.mock.calls.map(c => c[0]).join('');
      expect(allOutput).toMatch(/\n$/);
    });

    it('formats bid/ask/last/change/volume fields from QuoteData', () => {
      const stream = createMockStream();
      renderQuote(makeQuote(), false, stream as unknown as NodeJS.WriteStream);
      const allOutput = stream.write.mock.calls.map(c => c[0]).join('');
      expect(allOutput).toContain('5425.50');
      expect(allOutput).toContain('5425.25');
      expect(allOutput).toContain('5425.75');
      expect(allOutput).toContain('12.50');
    });
  });

  describe('renderDom', () => {
    it('formats bid levels (highest first) and ask levels (lowest first) with price and volume', () => {
      const stream = createMockStream();
      const levels: { bids: DomLevel[]; asks: DomLevel[] } = {
        bids: [
          { price: 5425.25, volume: 150 },
          { price: 5425.00, volume: 200 },
          { price: 5424.75, volume: 75 },
        ],
        asks: [
          { price: 5425.75, volume: 89 },
          { price: 5426.00, volume: 120 },
          { price: 5426.25, volume: 45 },
        ],
      };
      renderDom(levels, stream as unknown as NodeJS.WriteStream);
      const allOutput = stream.write.mock.calls.map(c => c[0]).join('');
      // Verify asks are present (lowest first from spread)
      expect(allOutput).toContain('5425.75');
      expect(allOutput).toContain('5426.00');
      expect(allOutput).toContain('5426.25');
      // Verify bids are present (highest first from spread)
      expect(allOutput).toContain('5425.25');
      expect(allOutput).toContain('5425.00');
      expect(allOutput).toContain('5424.75');
      // Verify volumes
      expect(allOutput).toContain('150');
      expect(allOutput).toContain('200');
      expect(allOutput).toContain('75');
      expect(allOutput).toContain('89');
      expect(allOutput).toContain('120');
      expect(allOutput).toContain('45');
    });
  });

  describe('renderTrade', () => {
    it('writes a single scrolling line with time, BUY/SELL label, volume, price', () => {
      const stream = createMockStream();
      renderTrade(makeTrade({ type: TradeLogType.Buy, volume: 5, price: 5425.50 }), stream as unknown as NodeJS.WriteStream);
      const allOutput = stream.write.mock.calls.map(c => c[0]).join('');
      expect(allOutput).toContain('BUY');
      expect(allOutput).toContain('5');
      expect(allOutput).toContain('5425.50');
      expect(allOutput).toMatch(/\n$/);
    });

    it('uses TradeLogType.Buy -> BUY and TradeLogType.Sell -> SELL (SAF-01)', () => {
      const stream = createMockStream();

      renderTrade(makeTrade({ type: TradeLogType.Buy }), stream as unknown as NodeJS.WriteStream);
      const buyOutput = stream.write.mock.calls.map(c => c[0]).join('');
      expect(buyOutput).toContain('BUY');

      vi.clearAllMocks();

      renderTrade(makeTrade({ type: TradeLogType.Sell }), stream as unknown as NodeJS.WriteStream);
      const sellOutput = stream.write.mock.calls.map(c => c[0]).join('');
      expect(sellOutput).toContain('SELL');
    });
  });

  describe('emitJsonEvent', () => {
    it('writes newline-delimited JSON object to stream', () => {
      const stream = createMockStream();
      const data = { lastPrice: 5425.50, bestBid: 5425.25 };
      emitJsonEvent('quote', data, stream as unknown as NodeJS.WriteStream);
      expect(stream.write).toHaveBeenCalledTimes(1);
      const output = stream.write.mock.calls[0][0] as string;
      expect(output).toMatch(/\n$/);
      const parsed = JSON.parse(output.trim());
      expect(parsed.type).toBe('quote');
      expect(parsed.lastPrice).toBe(5425.50);
      expect(parsed.bestBid).toBe(5425.25);
    });
  });
});
