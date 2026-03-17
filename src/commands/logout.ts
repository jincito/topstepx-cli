import { Command } from 'commander';
import { CredentialStore, clearToken } from '../auth/index.js';

/** Create a fresh logout Command instance. */
export function createLogoutCommand(): Command {
  return new Command('logout')
    .description('Clear stored credentials and session')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep logout             Clear stored credentials and log out
`,
    )
    .action(() => {
      const store = new CredentialStore();
      store.clear();
      clearToken();
      console.log('Credentials cleared. You are now logged out.');
    });
}

/** Default logout command instance for CLI registration. */
export const logoutCommand = createLogoutCommand();
