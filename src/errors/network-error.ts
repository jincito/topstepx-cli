import { CliError, type ErrorContext } from './base.js';

/**
 * Error thrown for network-level failures.
 * Used for connection refused, timeouts, DNS failures, etc.
 */
export class NetworkError extends CliError {
  readonly code = 'NETWORK_ERROR' as const;

  constructor(message: string, context: ErrorContext = {}) {
    super(message, context);
    // Fix instanceof in TypeScript-compiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
