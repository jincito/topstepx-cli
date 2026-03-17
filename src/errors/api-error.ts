import { CliError, type ErrorContext } from './base.js';

/**
 * Error thrown when the TopStepX API returns an error response.
 * Captures the HTTP status code or API error code alongside the message.
 */
export class ApiError extends CliError {
  readonly code = 'API_ERROR' as const;
  readonly errorCode: number;

  constructor(message: string, errorCode: number, context: ErrorContext = {}) {
    super(message, { ...context, errorCode });
    this.errorCode = errorCode;
    // Fix instanceof in TypeScript-compiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
