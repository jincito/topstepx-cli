import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { searchAccounts } from '../api/accounts.js';
import { output, verbose } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/index.js';

const COLUMNS: ColumnDef[] = [
  { key: 'id', header: 'ID', align: 'right' },
  { key: 'name', header: 'Name' },
  {
    key: 'balance',
    header: 'Balance',
    align: 'right',
    format: (v) =>
      typeof v === 'number'
        ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        : String(v),
  },
  { key: 'canTrade', header: 'Can Trade', format: (v) => (v ? 'Yes' : 'No') },
];

/** Create a fresh accounts Command instance. */
export function createAccountsCommand(): Command {
  return new Command('accounts')
    .description('List trading accounts')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep accounts              List all active accounts
  $ topstep accounts --json       Output as JSON for scripting
  $ topstep accounts --no-color   Plain text without ANSI colors
  $ topstep accounts --verbose    Show API request details
`,
    )
    .action(async (_options, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions;
      const cached = loadToken();

      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      verbose('accounts', 'Fetching active accounts');
      const result = await searchAccounts(cached.token, true);
      const rows = result.accounts.map((a) => ({ ...a }));
      output(rows, COLUMNS, globals);
    });
}

/** Default accounts command instance for CLI registration. */
export const accountsCommand = createAccountsCommand();
