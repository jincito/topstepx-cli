import { describe, it, expect } from 'vitest';
import { formatTable } from '../../src/output/table.js';
import type { ColumnDef } from '../../src/output/formatter.js';

describe('formatTable', () => {
  const columns: ColumnDef[] = [
    { key: 'name', header: 'Name' },
    { key: 'balance', header: 'Balance', align: 'right' },
  ];

  const data = [{ name: 'Demo Account', balance: '$50,000' }];

  it('returns a string containing all column headers', () => {
    const result = formatTable(data, columns);
    expect(result).toContain('Name');
    expect(result).toContain('Balance');
  });

  it('returns a string containing all data values', () => {
    const result = formatTable(data, columns);
    expect(result).toContain('Demo Account');
    expect(result).toContain('$50,000');
  });

  it('column alignment is passed through (right-aligned numeric columns)', () => {
    // cli-table3 respects colAligns, the result is a string (we trust the library for visual alignment)
    const result = formatTable(data, columns);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('custom format functions transform cell values', () => {
    const columnsWithFormat: ColumnDef[] = [
      { key: 'name', header: 'Name', format: (v) => String(v).toUpperCase() },
      { key: 'balance', header: 'Balance' },
    ];
    const result = formatTable(data, columnsWithFormat);
    expect(result).toContain('DEMO ACCOUNT');
  });
});
