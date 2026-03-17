import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import type { HubConnection } from '@microsoft/signalr';
import type { QuoteData } from '../types/api.js';

const MARKET_HUB_URL = 'https://rtc.topstepx.com/hubs/market';

/** Mutable token reference for persistent connections (token refresh updates in-place) */
export interface TokenHolder {
  token: string;
}

/**
 * Create a SignalR connection to the TopStepX Market Hub.
 *
 * Configuration:
 * - skipNegotiation: true (WebSocket-only, no fallback)
 * - transport: WebSockets (named constant, not bare integer)
 * - accessTokenFactory: returns the JWT token for authentication
 * - Logging at Warning level to avoid noisy output
 *
 * NOTE: Does NOT use withAutomaticReconnect -- this is for one-shot commands.
 */
export function createMarketHubConnection(token: string): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(MARKET_HUB_URL, {
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
      accessTokenFactory: () => token,
    })
    .configureLogging(LogLevel.Warning)
    .build();
}

/**
 * Fetch a single quote from the Market Hub using the one-shot pattern:
 * subscribe to GatewayQuote events, wait for the first matching event,
 * then resolve. Rejects on timeout.
 *
 * The caller is responsible for connection.start() before and connection.stop() after.
 *
 * @param connection - An active HubConnection (already started)
 * @param contractId - The full contract ID (e.g. "CON.F.US.EP.U25")
 * @param timeoutMs - Timeout in milliseconds (default 10000)
 * @returns Promise resolving to QuoteData from the first matching GatewayQuote event
 */
export function fetchOneQuote(
  connection: HubConnection,
  contractId: string,
  timeoutMs: number = 10000,
): Promise<QuoteData> {
  return new Promise<QuoteData>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for quote data'));
    }, timeoutMs);

    // GatewayQuote fires with two arguments: (receivedContractId, data)
    // Only resolve when the contractId matches our subscription
    connection.on('GatewayQuote', (receivedContractId: string, data: QuoteData) => {
      if (receivedContractId === contractId) {
        clearTimeout(timer);
        resolve(data);
      }
    });

    // Start the subscription -- if invoke fails, reject the promise
    connection.invoke('SubscribeContractQuotes', contractId).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Create a persistent SignalR connection to the TopStepX Market Hub.
 *
 * Differences from createMarketHubConnection:
 * - Uses withAutomaticReconnect with configurable retry delays
 * - Takes a TokenHolder (mutable reference) so token refresh takes effect on reconnect
 * - accessTokenFactory reads tokenHolder.token (current value, not captured string)
 *
 * @param tokenHolder - Mutable token reference; update .token to refresh credentials
 * @returns HubConnection configured for persistent streaming
 */
export function createPersistentMarketHub(tokenHolder: TokenHolder): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(MARKET_HUB_URL, {
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
      accessTokenFactory: () => tokenHolder.token,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();
}
