import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { searchContracts, getAvailableContracts } from '../api/contracts.js';
import { output, verbose } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/index.js';

const COLUMNS: ColumnDef[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'description', header: 'Description' },
  { key: 'tickSize', header: 'Tick Size', align: 'right' },
  { key: 'tickValue', header: 'Tick Value', align: 'right' },
  { key: 'activeContract', header: 'Active', format: (v) => (v ? 'Yes' : 'No') },
];

/** Create a fresh contracts Command instance. */
export function createContractsCommand(): Command {
  return new Command('contracts')
    .description('Search and list available contracts')
    .argument('[search]', 'Search text to filter contracts')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep contracts              List all available contracts
  $ topstep contracts ES           Search for E-mini S&P contracts
  $ topstep contracts --json       Output as JSON for scripting
`,
    )
    .action(async (search: string | undefined, _options, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions;
      const cached = loadToken();

      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      let result;
      if (search) {
        verbose('contracts', `Searching contracts for "${search}"`);
        result = await searchContracts(cached.token, search);
      } else {
        verbose('contracts', 'Fetching available contracts');
        result = await getAvailableContracts(cached.token);
      }

      const rows = result.contracts.map((c) => ({ ...c }));
      output(rows, COLUMNS, globals);
    });
}

/** Default contracts command instance for CLI registration. */
export const contractsCommand = createContractsCommand();
