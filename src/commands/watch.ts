import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { resolveSymbol } from '../services/symbol-resolver.js';
import { StreamingSession, setupGracefulShutdown } from '../services/streaming-session.js';
import { DomState } from '../services/dom-state.js';
import {
  renderHeader,
  renderQuote,
  renderDom,
  renderTrade,
  emitJsonEvent,
} from '../services/terminal-renderer.js';
import { verbose } from '../output/index.js';
import { AuthError } from '../errors/index.js';
import type { OutputOptions } from '../output/index.js';

/** Create a fresh watch Command instance. */
export function createWatchCommand(): Command {
  return new Command('watch')
    .description('Stream real-time market data')
    .argument('<symbol>', 'Trading symbol (e.g., ES, NQ, MES)')
    .option('--depth', 'Show depth of market (DOM) levels')
    .option('--trades', 'Show time and sales feed')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep watch ES             Stream live quotes for E-mini S&P 500
  $ topstep watch ES --depth     Include depth of market (DOM) levels
  $ topstep watch ES --trades    Include time and sales feed
  $ topstep watch ES --json      Output NDJSON for scripting
`,
    )
    .action(async (symbol: string, options, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions;
      const cached = loadToken();

      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // Resolve friendly symbol to full contractId
      const contractId = await resolveSymbol(symbol, cached.token);
      verbose('watch', `Streaming ${contractId}`);

      // Determine display mode
      const isJson = globals.json === true;
      const isTTY = process.stdout.isTTY === true;

      // DOM state for --depth accumulation
      const domState = new DomState();

      // Render initial header (non-JSON mode only)
      if (!isJson) {
        renderHeader(symbol);
      }

      // Build streaming options with callbacks
      const session = new StreamingSession(cached.token, {
        contractId,
        depth: options.depth === true,
        trades: options.trades === true,

        onQuote: (_contractId, data) => {
          if (isJson) {
            emitJsonEvent('quote', data);
          } else {
            renderQuote(data, isTTY);
            if (options.depth) {
              renderDom(domState.getTopLevels(5));
            }
          }
        },

        onDepth: (_contractId, data) => {
          domState.update(data);
          if (isJson) {
            emitJsonEvent('depth', data);
          }
        },

        onTrade: (_contractId, data) => {
          if (isJson) {
            emitJsonEvent('trade', data);
          } else {
            renderTrade(data);
          }
        },

        onReconnecting: (_error?: Error) => {
          process.stderr.write('Reconnecting...\n');
        },

        onReconnected: () => {
          process.stderr.write('Reconnected. Resuming stream.\n');
          if (!isJson) {
            renderHeader(symbol);
          }
        },

        onClose: (_error?: Error) => {
          process.stderr.write('Connection closed.\n');
        },
      });

      // Register graceful shutdown handlers
      setupGracefulShutdown(session);

      // Start the streaming session
      await session.start();

      // Keep the process alive until SIGINT/SIGTERM triggers shutdown
      await new Promise(() => {});
    });
}

/** Default watch command instance for CLI registration. */
export const watchCommand = createWatchCommand();
