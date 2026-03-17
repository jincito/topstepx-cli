import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Writable } from 'node:stream';
import {
  renderOrderEvent,
  renderPositionEvent,
  renderTradeEvent,
  renderAccountEvent,
} from '../../src/services/event-formatter.js';
import type { Order, Position, Trade, Account } from '../../src/types/api.js';

// ── Test Helpers ─────────────────────────────────────────────────────

/** Create a writable stream that captures output */
function createMockStream(): { stream: NodeJS.WriteStream; output: () => string } {
  let buffer = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      buffer += chunk.toString();
      callback();
    },
  }) as unknown as NodeJS.WriteStream;
  return { stream, output: () => buffer };
}

// ── Test Data ────────────────────────────────────────────────────────

const MOCK_ORDER: Order = {
  id: 100,
  accountId: 12345,
  contractId: 'CON.F.US.EP.U25',
  creationTimestamp: '2026-03-14T16:30:00Z',
  updateTimestamp: '2026-03-14T16:30:01Z',
  status: 2,  // Filled
  type: 2,    // Market
  side: 0,    // Bid (BUY)
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
  type: 1,  // Long
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
  side: 0,  // Bid (BUY)
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

// ── Tests ────────────────────────────────────────────────────────────

describe('renderOrderEvent', () => {
  it('renders a timestamped order line with status, side, size, contractId, and filledPrice', () => {
    const { stream, output } = createMockStream();

    renderOrderEvent(MOCK_ORDER, stream);

    const line = output();
    expect(line).toContain('ORDER');
    expect(line).toContain('Filled');    // orderStatusLabel(2) = 'Filled'
    expect(line).toContain('BUY');       // orderSideLabel(0) = 'BUY'
    expect(line).toContain('1');         // size
    expect(line).toContain('CON.F.US.EP.U25');
    expect(line).toContain('5425.50');   // filledPrice
    expect(line).toContain('\n');        // ends with newline
  });

  it('omits price when filledPrice is null', () => {
    const { stream, output } = createMockStream();

    const orderNoFill: Order = { ...MOCK_ORDER, filledPrice: null };
    renderOrderEvent(orderNoFill, stream);

    const line = output();
    expect(line).toContain('ORDER');
    expect(line).not.toContain('@ ');    // no price display
  });

  it('uses named enum labels (SAF-01): orderSideLabel and orderStatusLabel, not bare integers', () => {
    const { stream, output } = createMockStream();

    // SELL order with status Open
    const sellOrder: Order = { ...MOCK_ORDER, side: 1, status: 1 };
    renderOrderEvent(sellOrder, stream);

    const line = output();
    expect(line).toContain('SELL');   // orderSideLabel(1)
    expect(line).toContain('Open');   // orderStatusLabel(1)
    // Should NOT contain the raw integers as standalone display values
  });
});

describe('renderTradeEvent', () => {
  it('renders a timestamped trade line with side, size, contractId, price, and P&L', () => {
    const { stream, output } = createMockStream();

    renderTradeEvent(MOCK_TRADE, stream);

    const line = output();
    expect(line).toContain('TRADE');
    expect(line).toContain('BUY');       // orderSideLabel(0)
    expect(line).toContain('1');         // size
    expect(line).toContain('CON.F.US.EP.U25');
    expect(line).toContain('5425.50');   // price
    expect(line).toContain('125.00');    // P&L
    expect(line).toContain('\n');
  });

  it('omits P&L field when profitAndLoss is null (half-turn trade)', () => {
    const { stream, output } = createMockStream();

    const halfTurn: Trade = { ...MOCK_TRADE, profitAndLoss: null };
    renderTradeEvent(halfTurn, stream);

    const line = output();
    expect(line).toContain('TRADE');
    expect(line).not.toContain('P&L');
  });

  it('shows positive P&L with + sign', () => {
    const { stream, output } = createMockStream();

    renderTradeEvent(MOCK_TRADE, stream);

    const line = output();
    expect(line).toContain('+');
    expect(line).toContain('125.00');
  });

  it('shows negative P&L with - sign', () => {
    const { stream, output } = createMockStream();

    const lossTrade: Trade = { ...MOCK_TRADE, profitAndLoss: -50.00 };
    renderTradeEvent(lossTrade, stream);

    const line = output();
    expect(line).toContain('-50.00');
  });
});

describe('renderPositionEvent', () => {
  it('renders a timestamped position line with type, size, contractId, and average price', () => {
    const { stream, output } = createMockStream();

    renderPositionEvent(MOCK_POSITION, stream);

    const line = output();
    expect(line).toContain('POS');
    expect(line).toContain('Long');      // positionTypeLabel(1)
    expect(line).toContain('2');         // size
    expect(line).toContain('CON.F.US.EP.U25');
    expect(line).toContain('5425.25');   // averagePrice
    expect(line).toContain('\n');
  });

  it('uses positionTypeLabel for SAF-01 compliance', () => {
    const { stream, output } = createMockStream();

    const shortPos: Position = { ...MOCK_POSITION, type: 2 };
    renderPositionEvent(shortPos, stream);

    const line = output();
    expect(line).toContain('Short');  // positionTypeLabel(2)
  });
});

describe('renderAccountEvent', () => {
  it('renders a timestamped account line with name, balance, and canTrade', () => {
    const { stream, output } = createMockStream();

    renderAccountEvent(MOCK_ACCOUNT, stream);

    const line = output();
    expect(line).toContain('ACCT');
    expect(line).toContain('Combine Account 1');
    expect(line).toContain('50000.00');
    expect(line).toContain('true');
    expect(line).toContain('\n');
  });
});
