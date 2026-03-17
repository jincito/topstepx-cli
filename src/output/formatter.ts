import { formatTable } from './table.js';
import { formatJson } from './json.js';

/** Column definition for table output. */
export interface ColumnDef {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  format?: (value: unknown) => string;
}

/** Options controlling output format. */
export interface OutputOptions {
  json?: boolean;
  color?: boolean;
  verbose?: boolean;
}

/**
 * Unified output dispatcher: renders data as a table or JSON based on options.
 * All commands should use this single entry point for output.
 */
export function output(
  data: Record<string, unknown>[],
  columns: ColumnDef[],
  options: OutputOptions,
): void {
  if (options.json) {
    formatJson(data);
  } else {
    const tableStr = formatTable(data, columns, { color: options.color });
    process.stdout.write(tableStr + '\n');
  }
}
