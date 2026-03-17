import { Command } from 'commander';
import confirm from '@inquirer/confirm';
import { loadToken } from '../auth/token.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { resolveSymbol } from '../services/symbol-resolver.js';
import { searchOpenPositions, closePosition } from '../api/positions.js';
import { output } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/auth-error.js';
import { ValidationError } from '../errors/validation-error.js';

// ─── Output Columns ────────────────────────────────────────────────

const CONFIRM_COLUMNS: ColumnDef[] = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value', align: 'right' },
];

// ─── Flatten Command Factory ──────────────────────────────────────

/**
 * Factory that produces a Commander command for closing position(s).
 * With symbol: closes single position by resolved contractId.
 * Without symbol: fetches all positions and closes each.
 * Handles partial failures gracefully with per-position error handling.
 */
export function createFlattenCommand(): Command {
  return new Command('flatten')
    .description('Close position(s)')
    .argument('[symbol]', 'Trading symbol to close (omit to close all)')
    .option('--yes', 'Skip confirmation prompt')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep flatten ES               Close position for ES with confirmation
  $ topstep flatten                   Close all positions with confirmation
  $ topstep flatten --yes             Close all positions without confirmation
`,
    )
    .action(async (symbol: string | undefined, _opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & { account?: string; yes?: boolean };

      // 1. Auth check
      const cached = loadToken();
      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // 2. Resolve account
      const accountId = await resolveAccountId(globals, cached.token);

      if (symbol) {
        // ─── Single symbol flatten ────────────────────────────
        // 3a. Resolve to contractId
        const contractId = await resolveSymbol(symbol, cached.token);

        // 4a. Confirmation prompt
        if (!globals.yes) {
          if (!process.stdin.isTTY) {
            throw new ValidationError(
              'Flatten requires confirmation. Use --yes to skip in non-interactive mode.',
              { field: 'confirm' },
            );
          }
          const confirmed = await confirm({
            message: `Close position for ${symbol}?`,
            default: false,
          });
          if (!confirmed) {
            process.stderr.write('Cancelled.\n');
            return;
          }
        }

        // 5a. Close position
        await closePosition(cached.token, accountId, contractId);

        // 6a. Display success
        const rows: Record<string, unknown>[] = [
          { field: 'Symbol', value: symbol },
          { field: 'Contract', value: contractId },
          { field: 'Status', value: 'Closed' },
        ];
        output(rows, CONFIRM_COLUMNS, globals);
      } else {
        // ─── Flatten all positions ────────────────────────────
        // 3b. Fetch all open positions
        const response = await searchOpenPositions(cached.token, accountId);
        const positions = response.positions;

        // 4b. Handle empty positions
        if (positions.length === 0) {
          process.stderr.write('No open positions to flatten.\n');
          return;
        }

        // 5b. Confirmation prompt
        if (!globals.yes) {
          if (!process.stdin.isTTY) {
            throw new ValidationError(
              'Flatten requires confirmation. Use --yes to skip in non-interactive mode.',
              { field: 'confirm' },
            );
          }
          const confirmed = await confirm({
            message: `Close all ${positions.length} position(s)?`,
            default: false,
          });
          if (!confirmed) {
            process.stderr.write('Cancelled.\n');
            return;
          }
        }

        // 6b. Close each with per-position error handling
        let succeeded = 0;
        let failed = 0;
        for (const pos of positions) {
          try {
            await closePosition(cached.token, accountId, pos.contractId);
            succeeded++;
          } catch {
            failed++;
          }
        }

        // 7b. Report results
        process.stderr.write(
          `Closed ${succeeded}/${positions.length} position(s).${failed > 0 ? ` ${failed} failed.` : ''}\n`,
        );
      }
    });
}

// ─── Default Instance ──────────────────────────────────────────────

/** Default flatten command instance for CLI registration. */
export const flattenCommand = createFlattenCommand();
