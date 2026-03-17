// ─── Terminal Renderer ──────────────────────────────────────────────
// Renders streaming market data (quotes, DOM, time-and-sales) to the
// terminal with in-place updates on TTY and newline-separated fallback
// for non-TTY (piped) output.
// ─────────────────────────────────────────────────────────────────────

import * as readline from 'node:readline';
import { ansis, theme } from '../output/colors.js';
import { TradeLogType } from '../types/enums.js';
import type { QuoteData, MarketTradeData } from '../types/api.js';
import type { DomLevel } from './dom-state.js';

/**
 * Writes a one-time header line for the streaming session.
 */
export function renderHeader(symbol: string, stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(theme.header('Streaming: ' + symbol) + '\n');
}

/**
 * Renders a quote block with bid/ask/last/change/volume.
 * On TTY: uses in-place cursor control (cursorTo + clearScreenDown).
 * On non-TTY: writes newline-separated output.
 */
export function renderQuote(data: QuoteData, isTTY: boolean, stream: NodeJS.WriteStream = process.stdout): void {
  if (isTTY) {
    readline.cursorTo(stream, 0);
    readline.clearScreenDown(stream);
  }

  const changeSign = data.change >= 0 ? '+' : '';
  const changeColor = data.change >= 0 ? theme.success : theme.error;
  const changeStr = changeColor(`${changeSign}${data.change.toFixed(2)} (${changeSign}${data.changePercent.toFixed(2)}%)`);

  const lines = [
    `Last: ${theme.value(data.lastPrice.toFixed(2))}  Change: ${changeStr}`,
    `Bid:  ${theme.success(data.bestBid.toFixed(2))}  Ask: ${theme.error(data.bestAsk.toFixed(2))}`,
    `Vol:  ${theme.value(data.volume.toLocaleString())}`,
  ];

  stream.write(lines.join('\n') + '\n');

  if (!isTTY) {
    stream.write('\n');
  }
}

/**
 * Renders depth-of-market levels.
 * Asks are printed lowest-first (ascending from spread).
 * Bids are printed highest-first (descending from spread).
 */
export function renderDom(levels: { bids: DomLevel[]; asks: DomLevel[] }, stream: NodeJS.WriteStream = process.stdout): void {
  const lines: string[] = [];

  lines.push(theme.label('--- Depth ---'));

  // Asks: display in reverse order so highest ask is at top, lowest near spread
  const reversedAsks = [...levels.asks].reverse();
  for (const ask of reversedAsks) {
    lines.push(`${theme.error('ASK')}  ${theme.error(ask.price.toFixed(2))}  x ${ask.volume}`);
  }

  lines.push(theme.muted('---- ---- ----'));

  // Bids: highest first (descending from spread)
  for (const bid of levels.bids) {
    lines.push(`${theme.success('BID')}  ${theme.success(bid.price.toFixed(2))}  x ${bid.volume}`);
  }

  stream.write(lines.join('\n') + '\n');
}

/**
 * Renders a single time-and-sales trade line (scrolling, always appends newline).
 * Uses TradeLogType named constants for BUY/SELL labels (SAF-01).
 */
export function renderTrade(data: MarketTradeData, stream: NodeJS.WriteStream = process.stdout): void {
  const time = new Date(data.timestamp).toLocaleTimeString();
  const sideLabel = data.type === TradeLogType.Buy ? 'BUY' : 'SELL';
  const sideColor = data.type === TradeLogType.Buy ? theme.success : theme.error;

  stream.write(`${theme.muted(time)}  ${sideColor(sideLabel)}  ${data.volume} @ ${theme.value(data.price.toFixed(2))}\n`);
}

/**
 * Writes a newline-delimited JSON (NDJSON) event to the stream.
 * For --json mode streaming output.
 */
export function emitJsonEvent(type: string, data: unknown, stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(JSON.stringify({ type, ...(data as object) }) + '\n');
}
