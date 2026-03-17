import type { HubConnection } from '@microsoft/signalr';
import { createPersistentUserHub } from './user-hub.js';
import type { TokenHolder } from './market-hub.js';
import { refreshToken } from '../auth/client.js';
import {
  isTokenExpiringSoon,
  loadToken,
  saveToken,
  decodeJwtPayload,
} from '../auth/token.js';
import type { Order, Position, Trade, Account } from '../types/api.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface MonitorOptions {
  accountId: number;
  ordersOnly: boolean;
  positionsOnly: boolean;
  tradesOnly: boolean;
  onOrder: (data: Order) => void;
  onPosition: (data: Position) => void;
  onTrade: (data: Trade) => void;
  onAccount: (data: Account) => void;
  onReconnecting?: (error?: Error) => void;
  onReconnected?: () => void;
  onClose?: (error?: Error) => void;
}

/** Token refresh interval: check every 60 minutes */
const TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

// ─── MonitorSession ──────────────────────────────────────────────────

/**
 * Manages the full lifecycle of a persistent User Hub connection:
 * - Connect and subscribe to order/position/trade/account events
 * - Filter subscriptions based on --orders-only, --positions-only, --trades-only flags
 * - Automatic reconnection with re-subscription via onreconnected
 * - Background JWT token refresh for 23+ hour sessions
 * - Graceful shutdown: unsubscribe, stop connection, clear timers
 */
export class MonitorSession {
  private tokenHolder: TokenHolder;
  private connection: HubConnection | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly options: MonitorOptions;
  private readonly subscribeAll: boolean;

  constructor(token: string, options: MonitorOptions) {
    this.tokenHolder = { token };
    this.options = options;
    this.subscribeAll = !options.ordersOnly && !options.positionsOnly && !options.tradesOnly;
  }

  /**
   * Start the monitor session:
   * 1. Create persistent User Hub connection
   * 2. Register event handlers (filtered by flags)
   * 3. Wire reconnection callbacks
   * 4. Start the connection
   * 5. Subscribe to channels (filtered by flags)
   * 6. Start token refresh interval
   */
  async start(): Promise<void> {
    this.connection = createPersistentUserHub(this.tokenHolder);

    // Register event handlers based on filters
    if (this.subscribeAll || this.options.ordersOnly) {
      this.connection.on('GatewayUserOrder', (data: Order) => {
        this.options.onOrder(data);
      });
    }

    if (this.subscribeAll || this.options.positionsOnly) {
      this.connection.on('GatewayUserPosition', (data: Position) => {
        this.options.onPosition(data);
      });
    }

    if (this.subscribeAll || this.options.tradesOnly) {
      this.connection.on('GatewayUserTrade', (data: Trade) => {
        this.options.onTrade(data);
      });
    }

    if (this.subscribeAll) {
      this.connection.on('GatewayUserAccount', (data: Account) => {
        this.options.onAccount(data);
      });
    }

    // Wire reconnection callbacks
    this.connection.onreconnecting((error?: Error) => {
      if (this.options.onReconnecting) {
        this.options.onReconnecting(error);
      }
    });

    this.connection.onreconnected(() => {
      // Re-subscribe to all active channels
      this.resubscribe();
      if (this.options.onReconnected) {
        this.options.onReconnected();
      }
    });

    this.connection.onclose((error?: Error) => {
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
   * Stop the monitor session:
   * 1. Clear refresh timer
   * 2. Unsubscribe from all channels
   * 3. Stop the connection
   *
   * Never throws -- all errors are silently caught.
   */
  async stop(): Promise<void> {
    try {
      // Clear refresh timer first
      if (this.refreshTimer !== null) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }

      if (this.connection) {
        // Unsubscribe from all active channels
        if (this.subscribeAll || this.options.ordersOnly) {
          try {
            await this.connection.invoke('UnsubscribeOrders', this.options.accountId);
          } catch { /* ignore */ }
        }

        if (this.subscribeAll || this.options.positionsOnly) {
          try {
            await this.connection.invoke('UnsubscribePositions', this.options.accountId);
          } catch { /* ignore */ }
        }

        if (this.subscribeAll || this.options.tradesOnly) {
          try {
            await this.connection.invoke('UnsubscribeTrades', this.options.accountId);
          } catch { /* ignore */ }
        }

        if (this.subscribeAll) {
          try {
            await this.connection.invoke('UnsubscribeAccounts');
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

  /** Subscribe to all configured channels based on filter flags */
  private async subscribe(): Promise<void> {
    if (!this.connection) return;

    if (this.subscribeAll || this.options.ordersOnly) {
      await this.connection.invoke('SubscribeOrders', this.options.accountId);
    }

    if (this.subscribeAll || this.options.positionsOnly) {
      await this.connection.invoke('SubscribePositions', this.options.accountId);
    }

    if (this.subscribeAll || this.options.tradesOnly) {
      await this.connection.invoke('SubscribeTrades', this.options.accountId);
    }

    if (this.subscribeAll) {
      await this.connection.invoke('SubscribeAccounts');
    }
  }

  /** Re-subscribe to all active channels after reconnection */
  private resubscribe(): void {
    if (!this.connection) return;

    if (this.subscribeAll || this.options.ordersOnly) {
      this.connection.invoke('SubscribeOrders', this.options.accountId).catch(() => {});
    }

    if (this.subscribeAll || this.options.positionsOnly) {
      this.connection.invoke('SubscribePositions', this.options.accountId).catch(() => {});
    }

    if (this.subscribeAll || this.options.tradesOnly) {
      this.connection.invoke('SubscribeTrades', this.options.accountId).catch(() => {});
    }

    if (this.subscribeAll) {
      this.connection.invoke('SubscribeAccounts').catch(() => {});
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
