import Table from 'cli-table3';
import { theme } from './colors.js';
import type { ColumnDef } from './formatter.js';

/**
 * Format data as a CLI table string using cli-table3.
 * Returns the rendered string -- caller is responsible for writing to stdout.
 */
export function formatTable(
  data: Record<string, unknown>[],
  columns: ColumnDef[],
  options: { color?: boolean } = {},
): string {
  // Respect both the --no-color flag (color === false) and the NO_COLOR env var
  const useColor = options.color !== false && !process.env.NO_COLOR;

  const table = new Table({
    head: columns.map((col) => (useColor ? theme.header(col.header) : col.header)),
    colAligns: columns.map((col) => col.align ?? 'left'),
    // Disable cli-table3's built-in ANSI styling when color is off
    ...(useColor ? {} : { style: { head: [], border: [] } }),
  });

  for (const row of data) {
    const cells = columns.map((col) => {
      const value = row[col.key];
      return col.format ? col.format(value) : String(value ?? '');
    });
    table.push(cells);
  }

  return table.toString();
}
