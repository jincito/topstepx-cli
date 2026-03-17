import { CliError, ApiError, AuthError, NetworkError } from '../errors/index.js';
import { theme } from '../output/index.js';

/**
 * Structured error output for both human and JSON rendering.
 */
export interface RenderedError {
  message: string;
  guidance: string;
}

/**
 * Maps known API error codes to actionable guidance strings.
 */
const ERROR_GUIDANCE: Record<number, string> = {
  401: 'Session expired. Run: topstep login',
  429: 'Rate limited. Wait a moment and retry.',
};

/**
 * Transforms any error into a structured { message, guidance } object
 * suitable for display. Each CliError subclass gets specific guidance
 * to help the user resolve the issue.
 */
export function renderError(err: unknown): RenderedError {
  if (err instanceof ApiError) {
    return {
      message: `API Error: ${err.message}`,
      guidance: ERROR_GUIDANCE[err.errorCode] ?? 'Check the error message above and try again.',
    };
  }

  if (err instanceof AuthError) {
    return {
      message: err.message,
      guidance: 'Run: topstep login',
    };
  }

  if (err instanceof NetworkError) {
    return {
      message: `Network Error: ${err.message}`,
      guidance: 'Check your internet connection and try again.',
    };
  }

  if (err instanceof Error) {
    return {
      message: err.message,
      guidance: 'An unexpected error occurred.',
    };
  }

  return {
    message: String(err),
    guidance: 'An unexpected error occurred.',
  };
}

/**
 * Prints an error to the appropriate output stream.
 *
 * - Human mode (default): colored message + guidance to stderr
 * - JSON mode: structured JSON object to stdout for scripting
 */
export function printError(err: unknown, jsonMode: boolean = false): void {
  if (jsonMode) {
    const rendered = renderError(err);
    process.stdout.write(JSON.stringify({
      error: {
        code: err instanceof CliError ? err.code : 'UNKNOWN',
        message: rendered.message,
        guidance: rendered.guidance,
      },
    }) + '\n');
    return;
  }

  const { message, guidance } = renderError(err);
  console.error(theme.error(message));
  console.error(theme.muted(guidance));
}
