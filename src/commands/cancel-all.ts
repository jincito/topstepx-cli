import { Command } from 'commander';
import confirm from '@inquirer/confirm';
import { loadToken } from '../auth/token.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { searchOpenOrders, cancelOrder } from '../api/orders.js';
import type { OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/auth-error.js';
import { ValidationError } from '../errors/validation-error.js';

// ─── Cancel-All Command Factory ────────────────────────────────────

/**
 * Factory that produces a Commander command for canceling all open orders.
 * Handles partial failures gracefully: catches per-order errors and reports summary.
 */
export function createCancelAllCommand(): Command {
  return new Command('cancel-all')
    .description('Cancel all open orders')
    .option('--yes', 'Skip confirmation prompt')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep cancel-all                Cancel all with confirmation
  $ topstep cancel-all --yes          Skip confirmation prompt
`,
    )
    .action(async (_opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & { account?: string; yes?: boolean };

      // 1. Auth check
      const cached = loadToken();
      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // 2. Resolve account
      const accountId = await resolveAccountId(globals, cached.token);

      // 3. Fetch open orders
      const response = await searchOpenOrders(cached.token, accountId);
      const orders = response.orders;

      // 4. Handle empty orders
      if (orders.length === 0) {
        process.stderr.write('No open orders to cancel.\n');
        return;
      }

      // 5. Confirmation prompt
      if (!globals.yes) {
        if (!process.stdin.isTTY) {
          throw new ValidationError(
            'Cancel requires confirmation. Use --yes to skip in non-interactive mode.',
            { field: 'confirm' },
          );
        }
        const confirmed = await confirm({
          message: `Cancel all ${orders.length} open order(s)?`,
          default: false,
        });
        if (!confirmed) {
          process.stderr.write('Cancelled.\n');
          return;
        }
      }

      // 6. Cancel each order with per-order error handling
      let succeeded = 0;
      let failed = 0;
      for (const order of orders) {
        try {
          await cancelOrder(cached.token, accountId, order.id);
          succeeded++;
        } catch {
          failed++;
        }
      }

      // 7. Report results
      process.stderr.write(
        `Cancelled ${succeeded}/${orders.length} order(s).${failed > 0 ? ` ${failed} failed.` : ''}\n`,
      );
    });
}

// ─── Default Instance ──────────────────────────────────────────────

/** Default cancel-all command instance for CLI registration. */
export const cancelAllCommand = createCancelAllCommand();
