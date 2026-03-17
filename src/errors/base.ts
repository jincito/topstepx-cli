/**
 * Arbitrary key-value context attached to structured errors.
 * Used for domain-specific metadata (e.g., errorCode, field, url).
 */
export type ErrorContext = { [key: string]: unknown };

/**
 * Abstract base class for all CLI errors.
 *
 * Every subclass produces a structured { code, message, context } object
 * via toJSON(), enabling uniform error rendering across the CLI.
 *
 * Subclasses MUST define a readonly `code` string (e.g., 'API_ERROR').
 */
export abstract class CliError extends Error {
  abstract readonly code: string;
  readonly context: ErrorContext;

  constructor(message: string, context: ErrorContext = {}) {
    super(message);
    this.context = context;
    this.name = this.constructor.name;
    // Fix instanceof in TypeScript-compiled output
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a structured JSON representation of the error.
   */
  toJSON(): { code: string; message: string; context: ErrorContext } {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}
