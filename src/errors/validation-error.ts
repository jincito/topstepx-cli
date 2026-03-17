import { CliError, type ErrorContext } from './base.js';

/**
 * Error thrown for user input validation failures.
 * Optionally captures the field name that failed validation.
 */
export class ValidationError extends CliError {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly field?: string;

  constructor(message: string, context: ErrorContext = {}) {
    super(message, context);
    if (typeof context['field'] === 'string') {
      this.field = context['field'];
    }
    // Fix instanceof in TypeScript-compiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
