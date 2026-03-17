// ─── API Enum Constants ─────────────────────────────────────────────
// All values MUST match the TopStepX API documentation exactly (SAF-01).
// Use named constants everywhere; NEVER bare integers for API enums.
// ─────────────────────────────────────────────────────────────────────

/** OrderSide — used in order placement, order events, trade events */
export const OrderSide = Object.freeze({
  Bid: 0,
  Ask: 1,
} as const);
export type OrderSideValue = (typeof OrderSide)[keyof typeof OrderSide];

/** OrderType — used in order placement, bracket config, order events */
export const OrderType = Object.freeze({
  Unknown: 0,
  Limit: 1,
  Market: 2,
  StopLimit: 3,
  Stop: 4,
  TrailingStop: 5,
  JoinBid: 6,
  JoinAsk: 7,
} as const);
export type OrderTypeValue = (typeof OrderType)[keyof typeof OrderType];

/** OrderStatus — used in order search results and order events */
export const OrderStatus = Object.freeze({
  None: 0,
  Open: 1,
  Filled: 2,
  Cancelled: 3,
  Expired: 4,
  Rejected: 5,
  Pending: 6,
} as const);
export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus];

/** PositionType — used in position search results and events */
export const PositionType = Object.freeze({
  Undefined: 0,
  Long: 1,
  Short: 2,
} as const);
export type PositionTypeValue = (typeof PositionType)[keyof typeof PositionType];

/** TimeInForce — used in order placement */
export const TimeInForce = Object.freeze({
  Day: 0,
  GTC: 1,
  GTD: 2,
  IOC: 3,
  FOK: 4,
} as const);
export type TimeInForceValue = (typeof TimeInForce)[keyof typeof TimeInForce];

/** BarTimeUnit — used in /api/History/retrieveBars */
export const BarTimeUnit = Object.freeze({
  Second: 1,
  Minute: 2,
  Hour: 3,
  Day: 4,
  Week: 5,
  Month: 6,
} as const);
export type BarTimeUnitValue = (typeof BarTimeUnit)[keyof typeof BarTimeUnit];

/** DomType — used in Market Hub GatewayDepth events */
export const DomType = Object.freeze({
  Unknown: 0,
  Ask: 1,
  Bid: 2,
  BestAsk: 3,
  BestBid: 4,
  Trade: 5,
  Reset: 6,
  Low: 7,
  High: 8,
  NewBestBid: 9,
  NewBestAsk: 10,
  Fill: 11,
} as const);
export type DomTypeValue = (typeof DomType)[keyof typeof DomType];

/** TradeLogType — used in Market Hub GatewayTrade events */
export const TradeLogType = Object.freeze({
  Buy: 0,
  Sell: 1,
} as const);
export type TradeLogTypeValue = (typeof TradeLogType)[keyof typeof TradeLogType];

// ─── Display Helpers ────────────────────────────────────────────────

const SIDE_LABELS: Record<number, string> = {
  [OrderSide.Bid]: 'BUY',
  [OrderSide.Ask]: 'SELL',
};

/** Returns human-readable label for an OrderSide value */
export function orderSideLabel(side: OrderSideValue | number): string {
  return SIDE_LABELS[side] ?? 'UNKNOWN';
}

const TYPE_LABELS: Record<number, string> = {
  [OrderType.Unknown]: 'Unknown',
  [OrderType.Limit]: 'Limit',
  [OrderType.Market]: 'Market',
  [OrderType.StopLimit]: 'StopLimit',
  [OrderType.Stop]: 'Stop',
  [OrderType.TrailingStop]: 'TrailingStop',
  [OrderType.JoinBid]: 'JoinBid',
  [OrderType.JoinAsk]: 'JoinAsk',
};

/** Returns human-readable label for an OrderType value */
export function orderTypeLabel(type: OrderTypeValue | number): string {
  return TYPE_LABELS[type] ?? 'Unknown';
}

const STATUS_LABELS: Record<number, string> = {
  [OrderStatus.None]: 'None',
  [OrderStatus.Open]: 'Open',
  [OrderStatus.Filled]: 'Filled',
  [OrderStatus.Cancelled]: 'Cancelled',
  [OrderStatus.Expired]: 'Expired',
  [OrderStatus.Rejected]: 'Rejected',
  [OrderStatus.Pending]: 'Pending',
};

/** Returns human-readable label for an OrderStatus value */
export function orderStatusLabel(status: OrderStatusValue | number): string {
  return STATUS_LABELS[status] ?? 'Unknown';
}

const POSITION_TYPE_LABELS: Record<number, string> = {
  [PositionType.Undefined]: 'Undefined',
  [PositionType.Long]: 'Long',
  [PositionType.Short]: 'Short',
};

/** Returns human-readable label for a PositionType value */
export function positionTypeLabel(type: PositionTypeValue | number): string {
  return POSITION_TYPE_LABELS[type] ?? 'Unknown';
}
