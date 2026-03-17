import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { resolveAccountId } from '../services/account-resolver.js';
import { searchOpenPositions } from '../api/positions.js';
import { positionTypeLabel } from '../types/enums.js';
import { output } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/auth-error.js';

// ─── Output Columns ────────────────────────────────────────────────

const POSITION_COLUMNS: ColumnDef[] = [
  { key: 'contractId', header: 'Contract' },
  { key: 'side', header: 'Side' },
  { key: 'size', header: 'Size', align: 'right' },
  { key: 'averagePrice', header: 'Avg Price', align: 'right' },
  { key: 'pnl', header: 'Unrealized P&L', align: 'right' },
];

// ─── Positions Command Factory ────────────────────────────────────

/**
 * Factory that produces a Commander command for listing open positions.
 *
 * SAF-01: PositionType displayed via positionTypeLabel, never bare integers.
 */
export function createPositionsCommand(): Command {
  return new Command('positions')
    .description('List open positions')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep positions                List open positions
  $ topstep positions --json         Output as JSON
`,
    )
    .action(async (_opts, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions & { account?: string };

      // 1. Auth check
      const cached = loadToken();
      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      // 2. Resolve account
      const accountId = await resolveAccountId(globals, cached.token);

      // 3. Fetch open positions
      const response = await searchOpenPositions(cached.token, accountId);
      const positions = response.positions;

      // 4. Handle empty results
      if (positions.length === 0) {
        process.stderr.write('No open positions.\n');
        return;
      }

      // 5. Map positions to display rows with label helpers (SAF-01)
      const rows: Record<string, unknown>[] = positions.map((p) => ({
        contractId: p.contractId,
        side: positionTypeLabel(p.type),
        size: p.size,
        averagePrice: p.averagePrice,
        pnl: '--',
      }));

      // 6. Output
      output(rows, POSITION_COLUMNS, globals);
    });
}

// ─── Default Instance ──────────────────────────────────────────────

/** Default positions command instance for CLI registration. */
export const positionsCommand = createPositionsCommand();
