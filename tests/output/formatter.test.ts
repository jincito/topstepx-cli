import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { output } from '../../src/output/formatter.js';
import type { ColumnDef } from '../../src/output/formatter.js';

describe('output formatter', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let captured: string;

  const columns: ColumnDef[] = [
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status' },
  ];

  const data = [
    { name: 'Account1', status: 'Active' },
    { name: 'Account2', status: 'Inactive' },
  ];

  beforeEach(() => {
    captured = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      captured += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('output() with json=true writes JSON to stdout', () => {
    output(data, columns, { json: true });
    expect(stdoutSpy).toHaveBeenCalled();
    const parsed = JSON.parse(captured);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it('output() with json=false writes table to stdout', () => {
    output(data, columns, {});
    expect(stdoutSpy).toHaveBeenCalled();
    expect(captured).toContain('Name');
    expect(captured).toContain('Status');
  });

  it('JSON output is valid parseable JSON containing all data records', () => {
    output(data, columns, { json: true });
    const parsed = JSON.parse(captured);
    expect(parsed[0]).toEqual({ name: 'Account1', status: 'Active' });
    expect(parsed[1]).toEqual({ name: 'Account2', status: 'Inactive' });
  });

  it('table output contains column headers', () => {
    output(data, columns, {});
    expect(captured).toContain('Name');
    expect(captured).toContain('Status');
  });
});
