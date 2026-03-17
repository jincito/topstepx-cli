import { OrderType, orderSideLabel, orderTypeLabel } from '../types/enums.js';
import type { OrderTypeValue, OrderSideValue } from '../types/enums.js';
import { ValidationError } from '../errors/validation-error.js';

// ─── Types ──────────────────────────────────────────────────────────

/** Options for determining the order type from CLI flags */
export interface OrderTypeOpts {
  limit?: string;
  stop?: string;
  stopLimit?: string[];
}

/** Result of order type determination */
export interface OrderTypeResult {
  type: OrderTypeValue;
  limitPrice: number | null;
  stopPrice: number | null;
}

/** Bracket pair for stop-loss and take-profit */
export interface BracketResult {
  stopLossBracket: { ticks: number; type: number } | null;
  takeProfitBracket: { ticks: number; type: number } | null;
}

// ─── Order Type Determination ───────────────────────────────────────

/**
 * Map CLI price flags to an OrderType with parsed prices.
 *
 * - No flags -> Market
 * - --limit -> Limit
 * - --stop -> Stop
 * - --stop-limit [stop, limit] -> StopLimit
 *
 * Throws ValidationError if more than one flag is set.
 */
export function determineOrderType(opts: OrderTypeOpts): OrderTypeResult {
  const flagCount =
    (opts.limit !== undefined ? 1 : 0) +
    (opts.stop !== undefined ? 1 : 0) +
    (opts.stopLimit !== undefined ? 1 : 0);

  if (flagCount > 1) {
    throw new ValidationError(
      'Only one of --limit, --stop, or --stop-limit can be specified',
      { field: 'order-type' },
    );
  }

  // Market order (no price flags)
  if (flagCount === 0) {
    return { type: OrderType.Market, limitPrice: null, stopPrice: null };
  }

  // Limit order
  if (opts.limit !== undefined) {
    return {
      type: OrderType.Limit,
      limitPrice: parseFloat(opts.limit),
      stopPrice: null,
    };
  }

  // Stop order
  if (opts.stop !== undefined) {
    return {
      type: OrderType.Stop,
      limitPrice: null,
      stopPrice: parseFloat(opts.stop),
    };
  }

  // StopLimit order
  const [stopStr, limitStr] = opts.stopLimit!;
  return {
    type: OrderType.StopLimit,
    stopPrice: parseFloat(stopStr),
    limitPrice: parseFloat(limitStr),
  };
}

// ─── Bracket Construction ───────────────────────────────────────────

/**
 * Build stop-loss and take-profit bracket objects from CLI input.
 *
 * @param bracketArg - Array of two strings [stopLossTicks, takeProfitTicks], or undefined
 * @returns Bracket pair with null values when no brackets specified
 *
 * CRITICAL: bracket type uses OrderType.Limit named constant (SAF-01).
 */
export function buildBrackets(bracketArg?: string[]): BracketResult {
  if (bracketArg === undefined || bracketArg.length < 2) {
    return { stopLossBracket: null, takeProfitBracket: null };
  }

  const slTicks = parseInt(bracketArg[0], 10);
  const tpTicks = parseInt(bracketArg[1], 10);

  if (isNaN(slTicks) || slTicks <= 0) {
    throw new ValidationError(
      `Invalid stop-loss ticks: "${bracketArg[0]}". Must be a positive integer.`,
      { field: 'bracket' },
    );
  }

  if (isNaN(tpTicks) || tpTicks <= 0) {
    throw new ValidationError(
      `Invalid take-profit ticks: "${bracketArg[1]}". Must be a positive integer.`,
      { field: 'bracket' },
    );
  }

  return {
    stopLossBracket: { ticks: slTicks, type: OrderType.Limit },
    takeProfitBracket: { ticks: tpTicks, type: OrderType.Limit },
  };
}

// ─── Quantity Validation ────────────────────────────────────────────

/**
 * Parse and validate a quantity string from CLI input.
 *
 * Rejects NaN, zero, negative, and non-integer values.
 * @returns Parsed positive integer
 */
export function validateQuantity(input: string): number {
  const parsed = parseInt(input, 10);

  if (isNaN(parsed)) {
    throw new ValidationError(
      `Invalid quantity: "${input}". Must be a positive integer.`,
      { field: 'quantity' },
    );
  }

  if (parsed <= 0) {
    throw new ValidationError(
      `Invalid quantity: ${parsed}. Must be a positive integer.`,
      { field: 'quantity' },
    );
  }

  // Reject non-integer values like "1.5"
  if (input.includes('.') || parseFloat(input) !== parsed) {
    throw new ValidationError(
      `Invalid quantity: "${input}". Must be a whole number (no decimals).`,
      { field: 'quantity' },
    );
  }

  return parsed;
}

// ─── Confirm Message Formatting ─────────────────────────────────────

/**
 * Build a human-readable order confirmation message.
 *
 * Format: "Place BUY 1 ES (Market)?"
 *         "Place SELL 2 NQ (Limit) @ 5500?"
 *         "Place BUY 1 ES (Stop) stop 5400 [SL: 10 ticks, TP: 20 ticks]?"
 */
export function formatConfirmMessage(
  side: OrderSideValue | number,
  qty: number,
  symbol: string,
  orderType: OrderTypeValue | number,
  limitPrice: number | null,
  stopPrice: number | null,
  bracketStop: number | null,
  bracketProfit: number | null,
): string {
  const sideLabel = orderSideLabel(side);
  const typeLabel = orderTypeLabel(orderType);

  let msg = `Place ${sideLabel} ${qty} ${symbol} (${typeLabel})`;

  if (limitPrice !== null) {
    msg += ` @ ${limitPrice}`;
  }

  if (stopPrice !== null) {
    msg += ` stop ${stopPrice}`;
  }

  if (bracketStop !== null && bracketProfit !== null) {
    msg += ` [SL: ${bracketStop} ticks, TP: ${bracketProfit} ticks]`;
  }

  msg += '?';

  return msg;
}
