import input from '@inquirer/input';
import password from '@inquirer/password';

/**
 * Interactively prompt the user for TopStepX credentials.
 * Username is collected via text input; API key via masked password input.
 */
export async function promptCredentials(): Promise<{
  username: string;
  apiKey: string;
}> {
  const username = await input({
    message: 'TopStepX username:',
    validate: (v) => v.length > 0 || 'Username is required',
  });

  const apiKey = await password({
    message: 'API key:',
    mask: '*',
    validate: (v) => v.length > 0 || 'API key is required',
  });

  return { username, apiKey };
}
