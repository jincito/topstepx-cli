// ─── Stub API Response Types ────────────────────────────────────────
// Establishes the response envelope shape for future phases.
// Each endpoint will specialize ApiResponse<T> with its payload type.
// ─────────────────────────────────────────────────────────────────────

/** Standard API response envelope returned by all TopStepX endpoints */
export interface ApiResponse<T = unknown> {
  success: boolean;
  errorCode?: number;
  errorMessage?: string;
  token?: string;
  /** Payload varies by endpoint */
  [key: string]: T | boolean | number | string | undefined;
}

/** Structured API error for consistent error handling */
export interface ApiError {
  errorCode: number;
  errorMessage: string;
  endpoint?: string;
}

// ─── Account Types ──────────────────────────────────────────────────

/** A TopStepX trading account */
export interface Account {
  id: number;
  name: string;
  balance: number;
  canTrade: boolean;
  isVisible?: boolean;
  simulated?: boolean;
}

/** Response from POST /api/Account/search */
export interface AccountSearchResponse {
  accounts: Account[];
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
}

// ─── Contract Types ─────────────────────────────────────────────────

/** A TopStepX tradeable contract (instrument) */
export interface Contract {
  id: string;           // e.g. "CON.F.US.EP.U25"
  name: string;         // e.g. "ESU5"
  description: string;  // e.g. "E-mini S&P 500: September 2025"
  tickSize: number;
  tickValue: number;
  activeContract: boolean;
  symbolId: string;     // e.g. "F.US.EP"
}

/** Response from POST /api/Contract/search and /api/Contract/available */
export interface ContractSearchResponse {
  contracts: Contract[];
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
}

/** Response from POST /api/Contract/searchById */
export interface ContractByIdResponse {
  contract: Contract;
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
}

// ─── Bar / History Types ─────────────────────────────────────────

/** A single OHLCV bar from the History API */
export interface Bar {
  t: string;  // ISO 8601 timestamp
  o: number;  // Open
  h: number;  // High
  l: number;  // Low
  c: number;  // Close
  v: number;  // Volume
}

/** Response from POST /api/History/retrieveBars */
export interface BarResponse {
  bars: Bar[];
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
}

// ─── Quote Types ──────────────────────────────────────────────────

/** Quote data from Market Hub GatewayQuote event */
export interface QuoteData {
  symbol: string;
  symbolName: string;
  lastPrice: number;
  bestBid: number;
  bestAsk: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  lastUpdated: string;
  timestamp: string;
}

// ─── Order Types ──────────────────────────────────────────────────

/** Request body for POST /api/Order/place */
export interface PlaceOrderRequest {
  accountId: number;
  contractId: string;
  type: number;        // OrderTypeValue
  side: number;        // OrderSideValue
  size: number;
  limitPrice: number | null;
  stopPrice: number | null;
  trailPrice: number | null;
  customTag: string | null;
  stopLossBracket: { ticks: number; type: number } | null;
  takeProfitBracket: { ticks: number; type: number } | null;
}

/** Response from POST /api/Order/place */
export interface PlaceOrderResponse {
  orderId: number;
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
}

/** An order from the Order API search responses */
export interface Order {
  id: number;
  accountId: number;
  contractId: string;
  symbolId?: string;
  creationTimestamp: string;
  updateTimestamp: string;
  status: number;          // OrderStatusValue
  type: number;            // OrderTypeValue
  side: number;            // OrderSideValue
  size: number;
  limitPrice: number | null;
  stopPrice: number | null;
  fillVolume: number | null;
  filledPrice: number | null;
  customTag: string | null;
}

/** Response from POST /api/Order/searchOpen and /api/Order/search */
export interface OrderSearchResponse {
  orders: Order[];
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
}

/** Request body for POST /api/Order/modify */
export interface ModifyOrderRequest {
  accountId: number;
  orderId: number;
  size?: number;
  limitPrice?: number;
  stopPrice?: number;
  trailPrice?: number;
}

/** Standard success envelope for cancel/modify/close responses */
export interface SuccessResponse {
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
}

// ─── Position Types ──────────────────────────────────────────────

/** A position from the Position API */
export interface Position {
  id: number;
  accountId: number;
  contractId: string;
  creationTimestamp: string;
  type: number;            // PositionTypeValue
  size: number;
  averagePrice: number;
}

/** Response from POST /api/Position/searchOpen */
export interface PositionSearchResponse {
  positions: Position[];
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
}

// ─── Trade Types ─────────────────────────────────────────────────

/** A trade from the Trade API */
export interface Trade {
  id: number;
  accountId: number;
  contractId: string;
  creationTimestamp: string;
  price: number;
  profitAndLoss: number | null;   // null = half-turn (opening trade)
  fees: number;
  side: number;            // OrderSideValue
  size: number;
  voided: boolean;
  orderId: number;
}

/** Response from POST /api/Trade/search */
export interface TradeSearchResponse {
  trades: Trade[];
  success: boolean;
  errorCode?: number;
  errorMessage?: string | null;
}

// ─── Market Streaming Types ─────────────────────────────────────────

/** Depth data from Market Hub GatewayDepth event */
export interface DepthData {
  timestamp: string;
  type: number;           // DomTypeValue
  price: number;
  volume: number;
  currentVolume: number;
}

/** Trade data from Market Hub GatewayTrade event */
export interface MarketTradeData {
  symbolId: string;
  price: number;
  timestamp: string;
  type: number;           // TradeLogTypeValue
  volume: number;
}
