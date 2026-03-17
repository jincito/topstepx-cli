import { describe, it, expect } from 'vitest';
import { DomState } from '../../src/services/dom-state.js';
import { DomType } from '../../src/types/enums.js';
import type { DepthData } from '../../src/types/api.js';

function makeDepth(overrides: Partial<DepthData> = {}): DepthData {
  return {
    timestamp: '2026-03-14T12:00:00Z',
    type: DomType.Bid,
    price: 5425.00,
    volume: 100,
    currentVolume: 100,
    ...overrides,
  };
}

describe('DomState', () => {
  it('update() with DomType.Bid adds entry to bids map', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.Bid, price: 5425.00, volume: 100 }));
    const { bids } = state.getTopLevels(10);
    expect(bids).toContainEqual({ price: 5425.00, volume: 100 });
  });

  it('update() with DomType.Ask adds entry to asks map', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.Ask, price: 5426.00, volume: 50 }));
    const { asks } = state.getTopLevels(10);
    expect(asks).toContainEqual({ price: 5426.00, volume: 50 });
  });

  it('update() with DomType.BestBid adds entry to bids map', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.BestBid, price: 5425.50, volume: 200 }));
    const { bids } = state.getTopLevels(10);
    expect(bids).toContainEqual({ price: 5425.50, volume: 200 });
  });

  it('update() with DomType.BestAsk adds entry to asks map', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.BestAsk, price: 5425.75, volume: 150 }));
    const { asks } = state.getTopLevels(10);
    expect(asks).toContainEqual({ price: 5425.75, volume: 150 });
  });

  it('update() with DomType.NewBestBid adds entry to bids map', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.NewBestBid, price: 5425.25, volume: 300 }));
    const { bids } = state.getTopLevels(10);
    expect(bids).toContainEqual({ price: 5425.25, volume: 300 });
  });

  it('update() with DomType.NewBestAsk adds entry to asks map', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.NewBestAsk, price: 5426.25, volume: 75 }));
    const { asks } = state.getTopLevels(10);
    expect(asks).toContainEqual({ price: 5426.25, volume: 75 });
  });

  it('update() with volume=0 removes the level from its map', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.Bid, price: 5425.00, volume: 100 }));
    expect(state.getTopLevels(10).bids).toHaveLength(1);

    state.update(makeDepth({ type: DomType.Bid, price: 5425.00, volume: 0 }));
    expect(state.getTopLevels(10).bids).toHaveLength(0);
  });

  it('update() with DomType.Reset clears both bid and ask maps', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.Bid, price: 5425.00, volume: 100 }));
    state.update(makeDepth({ type: DomType.Ask, price: 5426.00, volume: 50 }));
    expect(state.getTopLevels(10).bids).toHaveLength(1);
    expect(state.getTopLevels(10).asks).toHaveLength(1);

    state.update(makeDepth({ type: DomType.Reset, price: 0, volume: 0 }));
    expect(state.getTopLevels(10).bids).toHaveLength(0);
    expect(state.getTopLevels(10).asks).toHaveLength(0);
  });

  it('update() ignores non-book types (Trade, Fill, Low, High, Unknown)', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.Trade, price: 5425.00, volume: 10 }));
    state.update(makeDepth({ type: DomType.Fill, price: 5425.00, volume: 10 }));
    state.update(makeDepth({ type: DomType.Low, price: 5400.00, volume: 0 }));
    state.update(makeDepth({ type: DomType.High, price: 5450.00, volume: 0 }));
    state.update(makeDepth({ type: DomType.Unknown, price: 5425.00, volume: 10 }));

    const { bids, asks } = state.getTopLevels(10);
    expect(bids).toHaveLength(0);
    expect(asks).toHaveLength(0);
  });

  it('getTopLevels(3) returns top 3 bids sorted highest-first and top 3 asks sorted lowest-first', () => {
    const state = new DomState();
    // Add 5 bid levels
    state.update(makeDepth({ type: DomType.Bid, price: 5420.00, volume: 10 }));
    state.update(makeDepth({ type: DomType.Bid, price: 5425.00, volume: 20 }));
    state.update(makeDepth({ type: DomType.Bid, price: 5423.00, volume: 30 }));
    state.update(makeDepth({ type: DomType.Bid, price: 5424.00, volume: 40 }));
    state.update(makeDepth({ type: DomType.Bid, price: 5421.00, volume: 50 }));

    // Add 5 ask levels
    state.update(makeDepth({ type: DomType.Ask, price: 5430.00, volume: 10 }));
    state.update(makeDepth({ type: DomType.Ask, price: 5426.00, volume: 20 }));
    state.update(makeDepth({ type: DomType.Ask, price: 5428.00, volume: 30 }));
    state.update(makeDepth({ type: DomType.Ask, price: 5427.00, volume: 40 }));
    state.update(makeDepth({ type: DomType.Ask, price: 5429.00, volume: 50 }));

    const { bids, asks } = state.getTopLevels(3);

    expect(bids).toHaveLength(3);
    expect(bids[0]).toEqual({ price: 5425.00, volume: 20 });
    expect(bids[1]).toEqual({ price: 5424.00, volume: 40 });
    expect(bids[2]).toEqual({ price: 5423.00, volume: 30 });

    expect(asks).toHaveLength(3);
    expect(asks[0]).toEqual({ price: 5426.00, volume: 20 });
    expect(asks[1]).toEqual({ price: 5427.00, volume: 40 });
    expect(asks[2]).toEqual({ price: 5428.00, volume: 30 });
  });

  it('getTopLevels(5) with fewer than 5 levels returns all available levels', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.Bid, price: 5425.00, volume: 100 }));
    state.update(makeDepth({ type: DomType.Bid, price: 5424.00, volume: 200 }));
    state.update(makeDepth({ type: DomType.Ask, price: 5426.00, volume: 50 }));

    const { bids, asks } = state.getTopLevels(5);
    expect(bids).toHaveLength(2);
    expect(asks).toHaveLength(1);
  });

  it('Multiple updates at same price replace previous volume (last write wins)', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.Bid, price: 5425.00, volume: 100 }));
    state.update(makeDepth({ type: DomType.Bid, price: 5425.00, volume: 250 }));

    const { bids } = state.getTopLevels(10);
    expect(bids).toHaveLength(1);
    expect(bids[0]).toEqual({ price: 5425.00, volume: 250 });
  });

  it('clear() empties both maps', () => {
    const state = new DomState();
    state.update(makeDepth({ type: DomType.Bid, price: 5425.00, volume: 100 }));
    state.update(makeDepth({ type: DomType.Ask, price: 5426.00, volume: 50 }));
    state.update(makeDepth({ type: DomType.Bid, price: 5424.00, volume: 200 }));

    state.clear();

    const { bids, asks } = state.getTopLevels(10);
    expect(bids).toHaveLength(0);
    expect(asks).toHaveLength(0);
  });
});
