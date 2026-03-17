/**
 * Write data as formatted JSON to stdout.
 * No colors, no formatting -- raw JSON only.
 */
export function formatJson(data: Record<string, unknown>[]): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}
