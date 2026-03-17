import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { modifyOrder } from '../api/orders.js';
import { output } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/auth-error.js';
import { ValidationError } from '../errors/validation-error.js';
import type { ModifyOrderRequest } from '../types/api.js';

// ─── Output Columns ────────────────────────────────────────────────

const CONFIRM_COLUMNS: ColumnDef[] = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value', align: 'right' },
];

// ─── Modify Command Factory ────────────────────────────────────────

/**
 * Factory that produces a Commander command for modifying a working order.
 * Only user-specified fields are sent in the modify request.
 */
export function createModifyCommand(): Command {
  return new Command('modify')
    .description('Modify a working order')
    .argument('<orderId>', 'Order ID to modify')
    .option('--limit <price>', 'New limit price')
    .option('--stop <price>', 'New stop price')
    .option('--size <qty>', 'New order size')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep modify 12345 --limit 5510         Change limit price
  $ topstep modify 12345 --stop 5400          Change stop price
  $ topstep modify 12345 --size 2             Change order size
  $ topstep modify 12345 --limit 5510 --size 2  Change multiple fields
`,
    )
    .action(async (orderIdStr: string, _opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & {
        account?: string;
        limit?: string;
        stop?: string;
        size?: string;
      };

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

      // 4. Build request with only user-specified fields
      const request: ModifyOrderRequest = { accountId, orderId };
      const changedFields: Record<string, unknown>[] = [];

      if (globals.limit !== undefined) {
        request.limitPrice = parseFloat(globals.limit);
        changedFields.push({ field: 'Limit Price', value: request.limitPrice });
      }
      if (globals.stop !== undefined) {
        request.stopPrice = parseFloat(globals.stop);
        changedFields.push({ field: 'Stop Price', value: request.stopPrice });
      }
      if (globals.size !== undefined) {
        request.size = parseInt(globals.size, 10);
        changedFields.push({ field: 'Size', value: request.size });
      }

      // 5. Validate at least one field changed
      if (changedFields.length === 0) {
        throw new ValidationError(
          'Specify at least one field to modify: --limit, --stop, or --size',
          { field: 'modify' },
        );
      }

      // 6. Send modify request
      await modifyOrder(cached.token, request);

      // 7. Display success as field/value detail rows
      const rows: Record<string, unknown>[] = [
        { field: 'Order ID', value: orderId },
        ...changedFields,
        { field: 'Status', value: 'Modified' },
      ];

      output(rows, CONFIRM_COLUMNS, globals);
    });
}

// ─── Default Instance ──────────────────────────────────────────────

/** Default modify command instance for CLI registration. */
export const modifyCommand = createModifyCommand();
