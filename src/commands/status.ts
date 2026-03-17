import { Command } from 'commander';
import {
  loadToken,
  decodeJwtPayload,
  refreshToken,
  API_BASE_URL,
} from '../auth/index.js';
import { output } from '../output/index.js';
import type { ColumnDef, OutputOptions } from '../output/index.js';

const STATUS_COLUMNS: ColumnDef[] = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value' },
];

/** Format milliseconds into a human-readable countdown string. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/** Create a fresh status Command instance. */
export function createStatusCommand(): Command {
  return new Command('status')
    .description('Show authentication and connection status')
    .addHelpText(
      'after',
      `
Examples:
  $ topstep status             Show current auth and connection status
  $ topstep status --json      Output status as JSON
`,
    )
    .action(async (_options, cmd) => {
      const globals = cmd.optsWithGlobals() as OutputOptions;
      const cached = loadToken();

      if (!cached) {
        console.log('Not logged in. Run: topstep login');
        return;
      }

      const payload = decodeJwtPayload(cached.token);
      const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;
      const now = Date.now();

      let tokenStatus: string;
      let countdown: string;

      if (!expiresAt) {
        tokenStatus = 'Unknown';
        countdown = 'N/A';
      } else if (now >= expiresAt.getTime()) {
        tokenStatus = 'Expired';
        countdown = 'Expired';
      } else {
        const remaining = expiresAt.getTime() - now;
        countdown = formatCountdown(remaining);
        // Consider "expiring soon" if less than 1 hour remaining
        tokenStatus = remaining < 3600000 ? 'Expiring Soon' : 'Valid';
      }

      // Check API connectivity via token refresh
      let apiStatus: string;
      try {
        await refreshToken(cached.token);
        apiStatus = 'Connected';
      } catch {
        apiStatus = 'Unreachable';
      }

      const rows: Record<string, unknown>[] = [
        { field: 'Username', value: cached.username },
        { field: 'Token Status', value: tokenStatus },
        { field: 'Expires', value: countdown },
        { field: 'API', value: apiStatus },
        { field: 'API URL', value: API_BASE_URL },
      ];

      output(rows, STATUS_COLUMNS, globals);
    });
}

/** Default status command instance for CLI registration. */
export const statusCommand = createStatusCommand();
