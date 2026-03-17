import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import type { HubConnection } from '@microsoft/signalr';
import type { TokenHolder } from './market-hub.js';

const USER_HUB_URL = 'https://rtc.topstepx.com/hubs/user';

/**
 * Create a persistent SignalR connection to the TopStepX User Hub.
 *
 * Configuration:
 * - skipNegotiation: true (WebSocket-only, no fallback)
 * - transport: WebSockets (named constant, not bare integer -- SAF-01)
 * - withAutomaticReconnect with configurable retry delays
 * - accessTokenFactory reads tokenHolder.token (mutable reference for token refresh)
 * - Logging at Warning level to avoid noisy output
 *
 * @param tokenHolder - Mutable token reference; update .token to refresh credentials
 * @returns HubConnection configured for persistent user event streaming
 */
export function createPersistentUserHub(tokenHolder: TokenHolder): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(USER_HUB_URL, {
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
      accessTokenFactory: () => tokenHolder.token,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();
}
