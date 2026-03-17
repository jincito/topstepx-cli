// ─── DOM State Manager ──────────────────────────────────────────────
// Accumulates GatewayDepth events into sorted bid/ask price-level maps.
// Pure data module with no SignalR dependency.
// ─────────────────────────────────────────────────────────────────────

import { DomType } from '../types/enums.js';
import type { DepthData } from '../types/api.js';

/** A single price level in the depth-of-market book */
export interface DomLevel {
  price: number;
  volume: number;
}

/** Set of DomType values that map to bid-side levels */
const BID_TYPES: Set<number> = new Set([DomType.Bid, DomType.BestBid, DomType.NewBestBid]);

/** Set of DomType values that map to ask-side levels */
const ASK_TYPES: Set<number> = new Set([DomType.Ask, DomType.BestAsk, DomType.NewBestAsk]);

/**
 * Manages depth-of-market state by accumulating GatewayDepth events
 * into bid and ask price-level maps.
 */
export class DomState {
  private bids: Map<number, number> = new Map(); // price -> volume
  private asks: Map<number, number> = new Map(); // price -> volume

  /**
   * Process a GatewayDepth event, updating the internal book state.
   *
   * - Bid/BestBid/NewBestBid -> bids map
   * - Ask/BestAsk/NewBestAsk -> asks map
   * - Reset -> clear both maps
   * - All other types (Trade, Fill, Low, High, Unknown) -> ignored
   * - Volume of 0 removes the level from its map
   */
  update(depth: DepthData): void {
    // Handle Reset: clear everything and return early
    if (depth.type === DomType.Reset) {
      this.bids.clear();
      this.asks.clear();
      return;
    }

    // Determine which map to update
    let map: Map<number, number> | null = null;
    if (BID_TYPES.has(depth.type)) {
      map = this.bids;
    } else if (ASK_TYPES.has(depth.type)) {
      map = this.asks;
    }

    // Ignore non-book types (Trade, Fill, Low, High, Unknown)
    if (!map) {
      return;
    }

    // Remove level if volume is zero, otherwise set price -> volume
    if (depth.volume === 0) {
      map.delete(depth.price);
    } else {
      map.set(depth.price, depth.volume);
    }
  }

  /**
   * Returns the top N price levels for both sides of the book.
   * Bids are sorted highest-first (descending by price).
   * Asks are sorted lowest-first (ascending by price).
   * Returns fewer than N levels if the book has fewer entries.
   */
  getTopLevels(n: number): { bids: DomLevel[]; asks: DomLevel[] } {
    const sortedBids = [...this.bids.entries()]
      .sort((a, b) => b[0] - a[0]) // highest price first
      .slice(0, n)
      .map(([price, volume]) => ({ price, volume }));

    const sortedAsks = [...this.asks.entries()]
      .sort((a, b) => a[0] - b[0]) // lowest price first
      .slice(0, n)
      .map(([price, volume]) => ({ price, volume }));

    return { bids: sortedBids, asks: sortedAsks };
  }

  /** Clear both bid and ask maps */
  clear(): void {
    this.bids.clear();
    this.asks.clear();
  }
}
