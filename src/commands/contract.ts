import { Command } from 'commander';
import { loadToken } from '../auth/token.js';
import { getContractById } from '../api/contracts.js';
import { output, verbose } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';
import { AuthError } from '../errors/index.js';

const DETAIL_COLUMNS: ColumnDef[] = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value' },
];

/** Create a fresh contract Command instance. */
export function createContractCommand(): Command {
  return new Command('contract')
    .description('Show contract details')
    .argument('<id>', 'Contract ID (e.g. CON.F.US.EP.U25)')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep contract CON.F.US.EP.U25        Show contract details
  $ topstep contract CON.F.US.EP.U25 --json  Output as JSON for scripting
`,
    )
    .action(async (id: string, _options, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions;
      const cached = loadToken();

      if (!cached) {
        throw new AuthError('Not authenticated. Run: topstep login');
      }

      verbose('contract', `Fetching contract ${id}`);
      const result = await getContractById(cached.token, id);

      const rows: Record<string, unknown>[] = [
        { field: 'ID', value: result.contract.id },
        { field: 'Name', value: result.contract.name },
        { field: 'Description', value: result.contract.description },
        { field: 'Symbol ID', value: result.contract.symbolId },
        { field: 'Tick Size', value: result.contract.tickSize },
        { field: 'Tick Value', value: result.contract.tickValue },
        { field: 'Active', value: result.contract.activeContract ? 'Yes' : 'No' },
      ];

      output(rows, DETAIL_COLUMNS, globals);
    });
}

/** Default contract command instance for CLI registration. */
export const contractCommand = createContractCommand();
