import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { resolveSymbol } from '../services/symbol-resolver.js';
import { createMarketHubConnection, fetchOneQuote } from '../services/market-hub.js';
import { output, verbose } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/index.js';

const QUOTE_COLUMNS: ColumnDef[] = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value', align: 'right' },
];

/** Create a fresh quotes Command instance. */
export function createQuotesCommand(): Command {
  return new Command('quotes')
    .description('Fetch current quote for a symbol')
    .argument('<symbol>', 'Trading symbol (e.g., ES, NQ, MES)')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep quotes ES           Fetch current E-mini S&P 500 quote
  $ topstep quotes NQ --json    Output quote as JSON for scripting
`,
    )
    .action(async (symbol: string, _options, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions;
      const cached = loadToken();

      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // Resolve friendly symbol to full contractId
      const contractId = await resolveSymbol(symbol, cached.token);
      verbose('quotes', `Fetching quote for ${contractId}`);

      // Create SignalR connection to Market Hub
      const connection = createMarketHubConnection(cached.token);

      try {
        await connection.start();
        const data = await fetchOneQuote(connection, contractId);

        // Clean unsubscribe before disconnect
        await connection.invoke('UnsubscribeContractQuotes', contractId);

        // Format as key-value pairs for detail view
        const rows: Record<string, unknown>[] = [
          { field: 'Symbol', value: data.symbolName || symbol },
          { field: 'Last', value: data.lastPrice },
          { field: 'Bid', value: data.bestBid },
          { field: 'Ask', value: data.bestAsk },
          { field: 'Change', value: `${data.change} (${data.changePercent}%)` },
          { field: 'Volume', value: data.volume },
          { field: 'Open', value: data.open },
          { field: 'High', value: data.high },
          { field: 'Low', value: data.low },
          { field: 'Updated', value: new Date(data.timestamp).toLocaleString() },
        ];

        output(rows, QUOTE_COLUMNS, globals);
      } catch (err: unknown) {
        // Handle timeout gracefully -- market may be closed
        if (err instanceof Error && err.message.includes('Timed out')) {
          process.stderr.write(
            'No quote received within 10s. Market may be closed or symbol may be inactive.\n',
          );
          process.exit(1);
          return;
        }
        throw err;
      } finally {
        await connection.stop();
      }
    });
}

/** Default quotes command instance for CLI registration. */
export const quotesCommand = createQuotesCommand();
