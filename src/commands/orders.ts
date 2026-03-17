import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { resolveSymbol } from '../services/symbol-resolver.js';
import { searchOpenOrders, searchOrders } from '../api/orders.js';
import { orderSideLabel, orderTypeLabel, orderStatusLabel } from '../types/enums.js';
import { output } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/auth-error.js';

// ─── Output Columns ────────────────────────────────────────────────

const ORDER_COLUMNS: ColumnDef[] = [
  { key: 'id', header: 'ID', align: 'right' },
  { key: 'contractId', header: 'Contract' },
  { key: 'side', header: 'Side' },
  { key: 'type', header: 'Type' },
  { key: 'size', header: 'Size', align: 'right' },
  { key: 'status', header: 'Status' },
  { key: 'limitPrice', header: 'Limit', align: 'right' },
  { key: 'stopPrice', header: 'Stop', align: 'right' },
];

// ─── Orders Command Factory ────────────────────────────────────────

/**
 * Factory that produces a Commander command for listing orders.
 *
 * SAF-01: All enum values displayed via label helpers, never bare integers.
 */
export function createOrdersCommand(): Command {
  return new Command('orders')
    .description('List orders')
    .option('--all', 'Include filled and cancelled orders (7-day window)')
    .option('--symbol <symbol>', 'Filter by trading symbol')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep orders                    List open/working orders
  $ topstep orders --all              Include filled and cancelled (7 days)
  $ topstep orders --symbol ES        Filter by symbol
`,
    )
    .action(async (_opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & { account?: string; all?: boolean; symbol?: string };

      // 1. Auth check
      const cached = loadToken();
      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // 2. Resolve account
      const accountId = await resolveAccountId(globals, cached.token);

      // 3. Fetch orders
      let orders;
      if (globals.all) {
        const startTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const response = await searchOrders(cached.token, accountId, startTimestamp);
        orders = response.orders;
      } else {
        const response = await searchOpenOrders(cached.token, accountId);
        orders = response.orders;
      }

      // 4. Filter by symbol if --symbol provided
      if (globals.symbol) {
        const resolvedContractId = await resolveSymbol(globals.symbol, cached.token);
        orders = orders.filter((o) => o.contractId === resolvedContractId);
      }

      // 5. Handle empty results
      if (orders.length === 0) {
        const message = globals.all ? 'No orders found.\n' : 'No open orders.\n';
        process.stderr.write(message);
        return;
      }

      // 6. Map orders to display rows with label helpers (SAF-01)
      const rows: Record<string, unknown>[] = orders.map((o) => ({
        ...o,
        side: orderSideLabel(o.side),
        type: orderTypeLabel(o.type),
        status: orderStatusLabel(o.status),
        limitPrice: o.limitPrice !== null ? o.limitPrice : '--',
        stopPrice: o.stopPrice !== null ? o.stopPrice : '--',
      }));

      // 7. Output
      output(rows, ORDER_COLUMNS, globals);
    });
}

// ─── Default Instance ──────────────────────────────────────────────

/** Default orders command instance for CLI registration. */
export const ordersCommand = createOrdersCommand();
