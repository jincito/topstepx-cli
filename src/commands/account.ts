import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { searchAccounts } from '../api/accounts.js';
import { output, verbose } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError, ValidationError, ApiError } from '../errors/index.js';

const DETAIL_COLUMNS: ColumnDef[] = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value' },
];

/** Create a fresh account Command instance. */
export function createAccountCommand(): Command {
  return new Command('account')
    .description('Show trading account details')
    .argument('<id>', 'Account ID to view')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep account 123456              Show account details
  $ topstep account 123456 --json       Output as JSON for scripting
`,
    )
    .action(async (id: string, _options, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions;
      const cached = loadToken();

      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      const parsedId = parseInt(id, 10);
      if (isNaN(parsedId)) {
        throw new ValidationError('Account ID must be a number', { field: 'id' });
      }

      verbose('account', `Fetching account ${parsedId}`);
      const result = await searchAccounts(cached.token);

      const account = result.accounts.find((a) => a.id === parsedId);
      if (!account) {
        throw new ApiError(`Account not found: ${parsedId}`, 0);
      }

      const formatCurrency = (v: number) =>
        v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

      const rows: Record<string, unknown>[] = [
        { field: 'ID', value: account.id },
        { field: 'Name', value: account.name },
        { field: 'Balance', value: formatCurrency(account.balance) },
        { field: 'Can Trade', value: account.canTrade ? 'Yes' : 'No' },
      ];

      if (account.isVisible !== undefined) {
        rows.push({ field: 'Visible', value: account.isVisible ? 'Yes' : 'No' });
      }

      if (account.simulated !== undefined) {
        rows.push({ field: 'Simulated', value: account.simulated ? 'Yes' : 'No' });
      }

      output(rows, DETAIL_COLUMNS, globals);
    });
}

/** Default account command instance for CLI registration. */
export const accountCommand = createAccountCommand();
