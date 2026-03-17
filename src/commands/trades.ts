import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { resolveSymbol } from '../services/symbol-resolver.js';
import { searchTrades } from '../api/trades.js';
import { orderSideLabel } from '../types/enums.js';
import { output } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/auth-error.js';
import { ValidationError } from '../errors/validation-error.js';

// ─── Output Columns ────────────────────────────────────────────────

const TRADE_COLUMNS: ColumnDef[] = [
  { key: 'id', header: 'ID', align: 'right' },
  { key: 'contractId', header: 'Contract' },
  { key: 'side', header: 'Side' },
  { key: 'size', header: 'Size', align: 'right' },
  { key: 'price', header: 'Price', align: 'right' },
  { key: 'pnl', header: 'P&L', align: 'right' },
  { key: 'fees', header: 'Fees', align: 'right' },
  { key: 'time', header: 'Time' },
];

// ─── Trades Command Factory ──────────────────────────────────────

/**
 * Factory that produces a Commander command for listing recent trades.
 *
 * SAF-01: OrderSide displayed via orderSideLabel, never bare integers.
 */
export function createTradesCommand(): Command {
  return new Command('trades')
    .description('List recent trades')
    .option('--from <date>', 'Start date (default: 7 days ago)')
    .option('--to <date>', 'End date')
    .option('--symbol <symbol>', 'Filter by trading symbol')
    .option('--limit <n>', 'Maximum number of results to display')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep trades                           List trades from last 7 days
  $ topstep trades --from 2026-03-01         Trades since March 1
  $ topstep trades --symbol ES --limit 20    Last 20 ES trades
`,
    )
    .action(async (_opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & {
        account?: string;
        from?: string;
        to?: string;
        symbol?: string;
        limit?: string;
      };

      // 1. Auth check
      const cached = loadToken();
      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // 2. Resolve account
      const accountId = await resolveAccountId(globals, cached.token);

      // 3. Parse --from: default to 7 days ago
      let startTimestamp: string;
      if (globals.from) {
        const parsed = Date.parse(globals.from);
        if (isNaN(parsed)) {
          throw new ValidationError('Invalid --from date format', { field: 'from' });
        }
        startTimestamp = new Date(parsed).toISOString();
      } else {
        startTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      // 4. Parse --to
      let endTimestamp: string | undefined;
      if (globals.to) {
        const parsed = Date.parse(globals.to);
        if (isNaN(parsed)) {
          throw new ValidationError('Invalid --to date format', { field: 'to' });
        }
        endTimestamp = new Date(parsed).toISOString();
      }

      // 5. Fetch trades
      const response = await searchTrades(cached.token, accountId, startTimestamp, endTimestamp);
      let trades = response.trades;

      // 6. Filter by symbol if --symbol provided
      if (globals.symbol) {
        const resolvedContractId = await resolveSymbol(globals.symbol, cached.token);
        trades = trades.filter((t) => t.contractId === resolvedContractId);
      }

      // 7. Apply --limit
      if (globals.limit) {
        const limit = parseInt(globals.limit, 10);
        if (isNaN(limit) || limit <= 0) {
          throw new ValidationError('--limit must be a positive number', { field: 'limit' });
        }
        trades = trades.slice(0, limit);
      }

      // 8. Handle empty results
      if (trades.length === 0) {
        process.stderr.write('No trades found.\n');
        return;
      }

      // 9. Map trades to display rows with label helpers (SAF-01)
      const rows: Record<string, unknown>[] = trades.map((t) => ({
        id: t.id,
        contractId: t.contractId,
        side: orderSideLabel(t.side),
        size: t.size,
        price: t.price,
        pnl: t.profitAndLoss !== null ? t.profitAndLoss.toFixed(2) : '--',
        fees: t.fees.toFixed(2),
        time: new Date(t.creationTimestamp).toLocaleString(),
      }));

      // 10. Output
      output(rows, TRADE_COLUMNS, globals);
    });
}

// ─── Default Instance ──────────────────────────────────────────────

/** Default trades command instance for CLI registration. */
export const tradesCommand = createTradesCommand();
