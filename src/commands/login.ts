import { Command } from 'commander';
import {
  promptCredentials,
  login,
  CredentialStore,
  saveToken,
  decodeJwtPayload,
} from '../auth/index.js';
import { AuthError } from '../errors/index.js';
import { theme } from '../output/index.js';

/** Create a fresh login Command instance. */
export function createLoginCommand(): Command {
  return new Command('login')
    .description('Authenticate with TopStepX')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep login              Prompt for username and API key
`,
    )
    .action(async () => {
      const { username, apiKey } = await promptCredentials();

      try {
        const token = await login(username, apiKey);
        const payload = decodeJwtPayload(token);

        const store = new CredentialStore();
        store.save({ username, apiKey });

        saveToken({
          token,
          acquiredAt: new Date().toISOString(),
          expiresAt: payload.exp
            ? new Date(payload.exp * 1000).toISOString()
            : 'unknown',
          username,
        });

        console.log(theme.success(`Logged in as ${username}`));
      } catch (err: unknown) {
        if (err instanceof AuthError) {
          console.error(theme.error(err.message));
          return;
        }
        throw err;
      }
    });
}

/** Default login command instance for CLI registration. */
export const loginCommand = createLoginCommand();
