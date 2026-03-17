import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { MonitorSession } from '../services/monitor-session.js';
import {
  renderOrderEvent,
  renderPositionEvent,
  renderTradeEvent,
  renderAccountEvent,
} from '../services/event-formatter.js';
import { emitJsonEvent } from '../services/terminal-renderer.js';
import { verbose } from '../output/index.js';
import { AuthError } from '../errors/index.js';
import type { OutputOptions } from '../output/index.js';

/**
 * Register SIGINT and SIGTERM handlers that gracefully shut down the monitor session.
 * Writes a shutdown message to stderr, awaits session.stop(), then exits.
 */
function setupMonitorShutdown(session: MonitorSession): void {
  const shutdown = async () => {
    process.stderr.write('\nShutting down...\n');
    await session.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/** Create a fresh monitor Command instance. */
export function createMonitorCommand(): Command {
  return new Command('monitor')
    .description('Stream real-time account events')
    .option('--orders-only', 'Show only order events')
    .option('--positions-only', 'Show only position events')
    .option('--trades-only', 'Show only trade events')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep monitor                  Stream all account events
  $ topstep monitor --orders-only    Stream only order events
  $ topstep monitor --trades-only    Stream only trade events
  $ topstep monitor --json           Output NDJSON for scripting
`,
    )
    .action(async (options, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & { account?: string };
      const cached = loadToken();

      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // Resolve account ID from --account flag or auto-default
      const accountId = await resolveAccountId(globals, cached.token);
      verbose('monitor', `Monitoring account ${accountId}`);

      // Determine display mode
      const isJson = globals.json === true;

      // Print header in non-JSON mode
      if (!isJson) {
        process.stdout.write(`Monitoring account ${accountId}...\n`);
      }

      // Build monitor options with callbacks
      const session = new MonitorSession(cached.token, {
        accountId,
        ordersOnly: options.ordersOnly === true,
        positionsOnly: options.positionsOnly === true,
        tradesOnly: options.tradesOnly === true,

        onOrder: (data) => {
          if (isJson) {
            emitJsonEvent('order', data);
          } else {
            renderOrderEvent(data);
          }
        },

        onPosition: (data) => {
          if (isJson) {
            emitJsonEvent('position', data);
          } else {
            renderPositionEvent(data);
          }
        },

        onTrade: (data) => {
          if (isJson) {
            emitJsonEvent('trade', data);
          } else {
            renderTradeEvent(data);
          }
        },

        onAccount: (data) => {
          if (isJson) {
            emitJsonEvent('account', data);
          } else {
            renderAccountEvent(data);
          }
        },

        onReconnecting: (_error?: Error) => {
          process.stderr.write('Reconnecting...\n');
        },

        onReconnected: () => {
          process.stderr.write('Reconnected. Resuming monitor.\n');
        },

        onClose: (_error?: Error) => {
          process.stderr.write('Connection closed.\n');
        },
      });

      // Register graceful shutdown handlers
      setupMonitorShutdown(session);

      // Start the monitor session
      await session.start();

      // Keep the process alive until SIGINT/SIGTERM triggers shutdown
      await new Promise(() => {});
    });
}

/** Default monitor command instance for CLI registration. */
export const monitorCommand = createMonitorCommand();
