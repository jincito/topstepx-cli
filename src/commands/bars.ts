import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { retrieveBars, parseInterval } from '../api/history.js';
import { resolveSymbol } from '../services/symbol-resolver.js';
import { output, verbose } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/index.js';

const BAR_COLUMNS: ColumnDef[] = [
  { key: 'time', header: 'Time' },
  { key: 'open', header: 'Open', align: 'right' },
  { key: 'high', header: 'High', align: 'right' },
  { key: 'low', header: 'Low', align: 'right' },
  { key: 'close', header: 'Close', align: 'right' },
  { key: 'volume', header: 'Volume', align: 'right' },
];

/** Create a fresh bars Command instance. */
export function createBarsCommand(): Command {
  return new Command('bars')
    .description('Retrieve historical OHLCV bars for a symbol')
    .argument('<symbol>', 'Trading symbol (e.g., ES, NQ, MES)')
    .option('--interval <interval>', 'Bar interval (1s, 5s, 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)', '5m')
    .option('--count <number>', 'Number of bars to retrieve (max 20000)', '20')
    .option('--from <date>', 'Start date (e.g., 2026-03-01)')
    .option('--to <date>', 'End date (e.g., 2026-03-14)')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep bars ES                          Last 20 five-minute bars
  $ topstep bars ES --interval 1h --count 50 Last 50 hourly bars
  $ topstep bars NQ --from 2026-03-01        Bars from March 1 to now
  $ topstep bars ES --json                   Output as JSON
`,
    )
    .action(async (symbol: string, opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions;
      const cached = loadToken();

      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // Resolve friendly symbol to contractId
      const contractId = await resolveSymbol(symbol, cached.token);

      // Parse interval -- throws ValidationError for invalid input
      const { unit, unitNumber } = parseInterval(opts.interval);

      // Parse count
      const limit = parseInt(opts.count, 10) || 20;

      // Compute date range
      // The API always requires both startTime and endTime even when using limit
      const endTime = opts.to
        ? new Date(opts.to).toISOString()
        : new Date().toISOString();
      const startTime = opts.from
        ? new Date(opts.from).toISOString()
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      verbose('bars', `Fetching ${limit} ${opts.interval} bars for ${contractId}`);

      const response = await retrieveBars(cached.token, {
        contractId,
        startTime,
        endTime,
        unit,
        unitNumber,
        limit,
      });

      if (response.bars.length === 0) {
        process.stderr.write('No bars returned for the specified range.\n');
        return;
      }

      const rows = response.bars.map((bar) => ({
        time: new Date(bar.t).toLocaleString(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));

      output(rows, BAR_COLUMNS, globals);
    });
}

/** Default bars command instance for CLI registration. */
export const barsCommand = createBarsCommand();
