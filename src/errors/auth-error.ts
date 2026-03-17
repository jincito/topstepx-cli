import { CliError, type ErrorContext } from './base.js';

/**
 * Error thrown for authentication and token failures.
 * Used when login fails, tokens expire, or credentials are invalid.
 */
export class AuthError extends CliError {
  readonly code = 'AUTH_ERROR' as const;

  constructor(message: string, context: ErrorContext = {}) {
    super(message, context);
    // Fix instanceof in TypeScript-compiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
