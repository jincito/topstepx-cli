// ─── Event Formatter ────────────────────────────────────────────────
// Renders streaming account events (orders, positions, trades, accounts)
// as timestamped single-line log entries for the terminal.
// Uses SAF-01 compliant named enum constants for all display values.
// ─────────────────────────────────────────────────────────────────────

import { theme } from '../output/colors.js';
import {
  orderSideLabel,
  orderStatusLabel,
  positionTypeLabel,
  OrderSide,
  PositionType,
} from '../types/enums.js';
import type { Order, Position, Trade, Account } from '../types/api.js';

/** Format a timestamp to HH:MM:SS for display */
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

/** Get color function based on order side */
function sideColor(side: number) {
  return side === OrderSide.Ask ? theme.error : theme.success;
}

/** Get color function based on position type */
function positionColor(type: number) {
  return type === PositionType.Short ? theme.error : theme.success;
}

/**
 * Render an order event as a timestamped single-line log entry.
 *
 * Format: [HH:MM:SS]  ORDER  {status}  {side} {size} {contractId} @ {filledPrice}
 * Omits "@ price" when filledPrice is null.
 */
export function renderOrderEvent(order: Order, stream: NodeJS.WriteStream = process.stdout): void {
  const time = formatTime(order.updateTimestamp);
  const status = orderStatusLabel(order.status);
  const side = orderSideLabel(order.side);
  const color = sideColor(order.side);

  let line = `${theme.muted(time)}  ${theme.label('ORDER')}  ${status}  ${color(side)} ${order.size} ${order.contractId}`;

  if (order.filledPrice !== null) {
    line += ` @ ${theme.value(order.filledPrice.toFixed(2))}`;
  }

  stream.write(line + '\n');
}

/**
 * Render a trade event as a timestamped single-line log entry.
 *
 * Format: [HH:MM:SS]  TRADE  {side} {size} {contractId} @ {price}  P&L: {pnl}
 * Omits P&L when profitAndLoss is null (half-turn / opening trade).
 * Shows + sign for positive P&L, - sign for negative.
 */
export function renderTradeEvent(trade: Trade, stream: NodeJS.WriteStream = process.stdout): void {
  const time = formatTime(trade.creationTimestamp);
  const side = orderSideLabel(trade.side);
  const color = sideColor(trade.side);

  let line = `${theme.muted(time)}  ${theme.label('TRADE')}  ${color(side)} ${trade.size} ${trade.contractId} @ ${theme.value(trade.price.toFixed(2))}`;

  if (trade.profitAndLoss !== null) {
    const sign = trade.profitAndLoss >= 0 ? '+' : '';
    const pnlColor = trade.profitAndLoss >= 0 ? theme.success : theme.error;
    line += `  P&L: ${pnlColor(`${sign}$${trade.profitAndLoss.toFixed(2)}`)}`;
  }

  stream.write(line + '\n');
}

/**
 * Render a position event as a timestamped single-line log entry.
 *
 * Format: [HH:MM:SS]  POS  {type} {size} {contractId} avg {averagePrice}
 */
export function renderPositionEvent(position: Position, stream: NodeJS.WriteStream = process.stdout): void {
  const time = formatTime(position.creationTimestamp);
  const posType = positionTypeLabel(position.type);
  const color = positionColor(position.type);

  const line = `${theme.muted(time)}  ${theme.label('POS')}  ${color(posType)} ${position.size} ${position.contractId} avg ${theme.value(position.averagePrice.toFixed(2))}`;

  stream.write(line + '\n');
}

/**
 * Render an account event as a timestamped single-line log entry.
 *
 * Format: [HH:MM:SS]  ACCT  {name}  Balance: ${balance}  CanTrade: {canTrade}
 */
export function renderAccountEvent(account: Account, stream: NodeJS.WriteStream = process.stdout): void {
  const time = new Date().toLocaleTimeString();

  const line = `${theme.muted(time)}  ${theme.label('ACCT')}  ${account.name}  Balance: $${theme.value(account.balance.toFixed(2))}  CanTrade: ${account.canTrade}`;

  stream.write(line + '\n');
}
