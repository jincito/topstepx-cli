import { Command } from 'commander';
import confirm from '@inquirer/confirm';
import { loadToken } from '../auth/token.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { cancelOrder } from '../api/orders.js';
import { output } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/auth-error.js';
import { ValidationError } from '../errors/validation-error.js';

// ─── Output Columns ────────────────────────────────────────────────

const CONFIRM_COLUMNS: ColumnDef[] = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value', align: 'right' },
];

// ─── Cancel Command Factory ────────────────────────────────────────

/**
 * Factory that produces a Commander command for canceling a single order.
 * Requires confirmation prompt (--yes to skip).
 */
export function createCancelCommand(): Command {
  return new Command('cancel')
    .description('Cancel a working order')
    .argument('<orderId>', 'Order ID to cancel')
    .option('--yes', 'Skip confirmation prompt')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep cancel 12345              Cancel with confirmation
  $ topstep cancel 12345 --yes        Skip confirmation prompt
`,
    )
    .action(async (orderIdStr: string, _opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & { account?: string; yes?: boolean };

      // 1. Auth check
      const cached = loadToken();
      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // 2. Parse and validate orderId
      const orderId = parseInt(orderIdStr, 10);
      if (isNaN(orderId)) {
        throw new ValidationError('Order ID must be a number', { field: 'orderId' });
      }

      // 3. Resolve account
      const accountId = await resolveAccountId(globals, cached.token);

      // 4. Confirmation prompt
      if (!globals.yes) {
        if (!process.stdin.isTTY) {
          throw new ValidationError(
            'Cancel requires confirmation. Use --yes to skip in non-interactive mode.',
            { field: 'confirm' },
          );
        }
        const confirmed = await confirm({
          message: `Cancel order ${orderId}?`,
          default: false,
        });
        if (!confirmed) {
          process.stderr.write('Cancelled.\n');
          return;
        }
      }

      // 5. Cancel order
      await cancelOrder(cached.token, accountId, orderId);

      // 6. Display success
      const rows: Record<string, unknown>[] = [
        { field: 'Order ID', value: orderId },
        { field: 'Status', value: 'Cancelled' },
      ];

      output(rows, CONFIRM_COLUMNS, globals);
    });
}

// ─── Default Instance ──────────────────────────────────────────────

/** Default cancel command instance for CLI registration. */
export const cancelCommand = createCancelCommand();
