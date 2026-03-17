import type { HubConnection } from '@microsoft/signalr';
import { createPersistentMarketHub } from './market-hub.js';
import type { TokenHolder } from './market-hub.js';
import { refreshToken } from '../auth/client.js';
import {
  isTokenExpiringSoon,
  loadToken,
  saveToken,
  decodeJwtPayload,
} from '../auth/token.js';
import type { QuoteData, DepthData, MarketTradeData } from '../types/api.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface StreamingOptions {
  contractId: string;
  depth: boolean;
  trades: boolean;
  onQuote: (contractId: string, data: QuoteData) => void;
  onDepth?: (contractId: string, data: DepthData) => void;
  onTrade?: (contractId: string, data: MarketTradeData) => void;
  onReconnecting?: (error?: Error) => void;
  onReconnected?: () => void;
  onClose?: (error?: Error) => void;
}

/** Token refresh interval: check every 60 minutes */
const TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

// ─── StreamingSession ────────────────────────────────────────────────

/**
 * Manages the full lifecycle of a persistent Market Hub connection:
 * - Connect and subscribe to GatewayQuote (and optionally GatewayDepth/GatewayTrade)
 * - Automatic reconnection with re-subscription via onreconnected
 * - Background JWT token refresh for 23+ hour sessions
 * - Graceful shutdown: unsubscribe, stop connection, clear timers
 */
export class StreamingSession {
  private tokenHolder: TokenHolder;
  private connection: HubConnection | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private shutdownRequested = false;
  private readonly options: StreamingOptions;

  constructor(token: string, options: StreamingOptions) {
    this.tokenHolder = { token };
    this.options = options;
  }

  /**
   * Start the streaming session:
   * 1. Create persistent Market Hub connection
   * 2. Register event handlers (GatewayQuote, optionally GatewayDepth/GatewayTrade)
   * 3. Wire reconnection callbacks
   * 4. Start the connection
   * 5. Subscribe to channels
   * 6. Start token refresh interval
   */
  async start(): Promise<void> {
    this.connection = createPersistentMarketHub(this.tokenHolder);

    // Register event handlers
    this.connection.on('GatewayQuote', (contractId: string, data: QuoteData) => {
      if (contractId === this.options.contractId) {
        this.options.onQuote(contractId, data);
      }
    });

    if (this.options.depth && this.options.onDepth) {
      this.connection.on('GatewayDepth', (contractId: string, data: DepthData) => {
        if (contractId === this.options.contractId) {
          this.options.onDepth!(contractId, data);
        }
      });
    }

    if (this.options.trades && this.options.onTrade) {
      this.connection.on('GatewayTrade', (contractId: string, data: MarketTradeData) => {
        if (contractId === this.options.contractId) {
          this.options.onTrade!(contractId, data);
        }
      });
    }

    // Wire reconnection callbacks
    this.connection.onreconnecting((error?: Error) => {
      if (this.options.onReconnecting) {
        this.options.onReconnecting(error);
      }
    });

    this.connection.onreconnected(() => {
      // Re-subscribe to all tracked channels
      this.resubscribe();
      if (this.options.onReconnected) {
        this.options.onReconnected();
      }
    });

    this.connection.onclose((error?: Error) => {
      this.shutdownRequested = true;
      if (this.options.onClose) {
        this.options.onClose(error);
      }
    });

    // Start connection
    await this.connection.start();

    // Subscribe to channels
    await this.subscribe();

    // Start token refresh interval
    this.startTokenRefresh();
  }

  /**
   * Stop the streaming session:
   * 1. Set shutdown flag
   * 2. Unsubscribe from all channels
   * 3. Stop the connection
   * 4. Clear refresh timer
   *
   * Never throws -- all errors are silently caught.
   */
  async stop(): Promise<void> {
    this.shutdownRequested = true;

    try {
      // Clear refresh timer first
      if (this.refreshTimer !== null) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }

      if (this.connection) {
        // Unsubscribe from all channels
        try {
          await this.connection.invoke('UnsubscribeContractQuotes', this.options.contractId);
        } catch { /* ignore */ }

        if (this.options.depth) {
          try {
            await this.connection.invoke('UnsubscribeContractDepth', this.options.contractId);
          } catch { /* ignore */ }
        }

        if (this.options.trades) {
          try {
            await this.connection.invoke('UnsubscribeContractTrades', this.options.contractId);
          } catch { /* ignore */ }
        }

        // Stop connection
        try {
          await this.connection.stop();
        } catch { /* ignore */ }
      }
    } catch {
      // stop() must never throw
    }
  }

  /** Subscribe to all configured channels */
  private async subscribe(): Promise<void> {
    if (!this.connection) return;

    await this.connection.invoke('SubscribeContractQuotes', this.options.contractId);

    if (this.options.depth) {
      await this.connection.invoke('SubscribeContractDepth', this.options.contractId);
    }

    if (this.options.trades) {
      await this.connection.invoke('SubscribeContractTrades', this.options.contractId);
    }
  }

  /** Re-subscribe to all channels after reconnection */
  private resubscribe(): void {
    if (!this.connection) return;

    this.connection.invoke('SubscribeContractQuotes', this.options.contractId).catch(() => {});

    if (this.options.depth) {
      this.connection.invoke('SubscribeContractDepth', this.options.contractId).catch(() => {});
    }

    if (this.options.trades) {
      this.connection.invoke('SubscribeContractTrades', this.options.contractId).catch(() => {});
    }
  }

  /** Start the periodic token refresh check */
  private startTokenRefresh(): void {
    this.refreshTimer = setInterval(async () => {
      try {
        if (isTokenExpiringSoon(this.tokenHolder.token)) {
          const newToken = await refreshToken(this.tokenHolder.token);
          this.tokenHolder.token = newToken;

          // Update disk cache
          const cached = loadToken();
          if (cached) {
            const payload = decodeJwtPayload(newToken);
            saveToken({
              ...cached,
              token: newToken,
              acquiredAt: new Date().toISOString(),
              expiresAt: payload.exp
                ? new Date(payload.exp * 1000).toISOString()
                : cached.expiresAt,
            });
          }
        }
      } catch {
        // Token refresh failure is non-fatal -- log to stderr but don't crash
        process.stderr.write('Warning: Token refresh failed. Will retry next interval.\n');
      }
    }, TOKEN_REFRESH_INTERVAL_MS);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────────

/**
 * Register SIGINT and SIGTERM handlers that gracefully shut down the streaming session.
 * Writes a shutdown message to stderr, awaits session.stop(), then exits.
 */
export function setupGracefulShutdown(session: StreamingSession): void {
  const shutdown = async () => {
    process.stderr.write('\nShutting down...\n');
    await session.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
