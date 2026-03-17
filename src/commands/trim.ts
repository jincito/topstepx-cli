import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { resolveSymbol } from '../services/symbol-resolver.js';
import { partialClosePosition } from '../api/positions.js';
import { output } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/auth-error.js';
import { ValidationError } from '../errors/validation-error.js';

// ─── Output Columns ────────────────────────────────────────────────

const CONFIRM_COLUMNS: ColumnDef[] = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value', align: 'right' },
];

// ─── Trim Command Factory ─────────────────────────────────────────

/**
 * Factory that produces a Commander command for partially closing a position.
 * Validates qty as a positive whole number, then calls partialClosePosition.
 */
export function createTrimCommand(): Command {
  return new Command('trim')
    .description('Partially close a position')
    .argument('<symbol>', 'Trading symbol (e.g., ES, NQ, MES)')
    .argument('<qty>', 'Number of contracts to close')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep trim ES 1                Close 1 contract of ES position
  $ topstep trim NQ 2                Close 2 contracts of NQ position
`,
    )
    .action(async (symbol: string, qtyStr: string, _opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & { account?: string };

      // 1. Auth check
      const cached = loadToken();
      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // 2. Resolve symbol to contractId
      const contractId = await resolveSymbol(symbol, cached.token);

      // 3. Resolve account
      const accountId = await resolveAccountId(globals, cached.token);

      // 4. Validate qty: must be a positive whole number
      const size = parseInt(qtyStr, 10);
      if (isNaN(size) || size <= 0 || parseFloat(qtyStr) !== parseInt(qtyStr, 10)) {
        throw new ValidationError(
          'Quantity must be a positive whole number',
          { field: 'qty' },
        );
      }

      // 5. Partial close position
      await partialClosePosition(cached.token, accountId, contractId, size);

      // 6. Display success details
      const rows: Record<string, unknown>[] = [
        { field: 'Symbol', value: symbol },
        { field: 'Contract', value: contractId },
        { field: 'Quantity Closed', value: size },
      ];
      output(rows, CONFIRM_COLUMNS, globals);
    });
}

// ─── Default Instance ──────────────────────────────────────────────

/** Default trim command instance for CLI registration. */
export const trimCommand = createTrimCommand();
