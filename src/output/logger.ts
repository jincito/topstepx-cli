let _verbose = false;

/** Enable or disable verbose diagnostic logging. */
export function setVerbose(enabled: boolean): void {
  _verbose = enabled;
}

/**
 * Log a diagnostic message to stderr when verbose mode is enabled.
 * Output goes to stderr to keep stdout clean for piping.
 */
export function verbose(label: string, data?: unknown): void {
  if (!_verbose) return;
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.error(
      `[${timestamp}] ${label}:`,
      typeof data === 'object' ? JSON.stringify(data, null, 2) : data,
    );
  } else {
    console.error(`[${timestamp}] ${label}`);
  }
}
