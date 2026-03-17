import { Command } from 'commander';
import { version } from './version.js';
import { ensureConfigDir } from './config/paths.js';
import { setVerbose } from './output/index.js';
import { accountsCommand } from './commands/accounts.js';
import { accountCommand } from './commands/account.js';
import { contractsCommand } from './commands/contracts.js';
import { contractCommand } from './commands/contract.js';
import { barsCommand } from './commands/bars.js';
import { buyCommand } from './commands/buy.js';
import { quotesCommand } from './commands/quotes.js';
import { sellCommand } from './commands/sell.js';
import { ordersCommand } from './commands/orders.js';
import { modifyCommand } from './commands/modify.js';
import { cancelCommand } from './commands/cancel.js';
import { cancelAllCommand } from './commands/cancel-all.js';
import { positionsCommand } from './commands/positions.js';
import { flattenCommand } from './commands/flatten.js';
import { trimCommand } from './commands/trim.js';
import { tradesCommand } from './commands/trades.js';
import { watchCommand } from './commands/watch.js';
import { monitorCommand } from './commands/monitor.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { statusCommand } from './commands/status.js';
import { ensureAuth } from './auth/index.js';
import { CliError } from './errors/index.js';
import { printError } from './api/index.js';

const program = new Command();

program
  .name('topstep')
  .description('TopStepX trading CLI')
  .version(version);

// Global flags available to all subcommands via optsWithGlobals()
program
  .option('--json', 'Output as JSON instead of table')
  .option('--no-color', 'Disable colored output')
  .option('--verbose', 'Show API request/response details')
  .option('--account <id>', 'Trading account ID (default: first active)');

// Show global options in subcommand --help output
program.configureHelp({ showGlobalOptions: true });

// Wire verbose mode, NO_COLOR, and auth middleware before any command action runs
program.hook('preAction', async (thisCommand, actionCommand) => {
  const opts = thisCommand.optsWithGlobals();
  if (opts.color === false) {
    process.env.NO_COLOR = '1';
  }
  if (opts.verbose) {
    setVerbose(true);
  }

  try {
    await ensureAuth(actionCommand);
  } catch (err: unknown) {
    if (err instanceof CliError) {
      printError(err, opts.json === true);
      process.exit(1);
    }
    throw err;
  }
});

// Register subcommands (configureHelp on each to show global options in their --help)
program.addCommand(loginCommand);
loginCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(logoutCommand);
logoutCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(statusCommand);
statusCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(accountsCommand);
accountsCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(accountCommand);
accountCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(contractsCommand);
contractsCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(contractCommand);
contractCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(barsCommand);
barsCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(quotesCommand);
quotesCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(buyCommand);
buyCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(sellCommand);
sellCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(ordersCommand);
ordersCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(modifyCommand);
modifyCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(cancelCommand);
cancelCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(cancelAllCommand);
cancelAllCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(positionsCommand);
positionsCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(flattenCommand);
flattenCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(trimCommand);
trimCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(tradesCommand);
tradesCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(watchCommand);
watchCommand.configureHelp({ showGlobalOptions: true });

program.addCommand(monitorCommand);
monitorCommand.configureHelp({ showGlobalOptions: true });

// Safety net: render uncaught exceptions cleanly instead of raw stack traces
process.on('uncaughtException', (err) => {
  printError(err);
  process.exit(1);
});

ensureConfigDir();
program.parseAsync(process.argv);
