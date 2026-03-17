import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Resolve a local node_modules bin command to its JS entry point.
 * @param pkg - npm package name (e.g. 'tsup', 'typescript')
 * @param bin - bin command name if different from package name (e.g. 'tsc')
 */
function resolveBin(pkg: string, bin?: string): string {
  const pkgJsonPath = require.resolve(`${pkg}/package.json`);
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  const binName = bin ?? pkg;
  const binEntry = typeof pkgJson.bin === 'string' ? pkgJson.bin : pkgJson.bin[binName];
  return resolve(dirname(pkgJsonPath), binEntry);
}

/** Run a local bin command cross-platform using node directly */
function runBin(pkg: string, args: string[] = [], bin?: string): string {
  const resolved = resolveBin(pkg, bin);
  return execFileSync(process.execPath, [resolved, ...args], {
    encoding: 'utf-8',
    stdio: 'pipe',
    cwd: process.cwd(),
  });
}

describe('Build pipeline (INF-01)', () => {
  beforeAll(() => {
    runBin('tsup');
  });

  it('produces dist/cli.js', () => {
    expect(existsSync(join(process.cwd(), 'dist', 'cli.js'))).toBe(true);
  });

  it('dist/cli.js starts with shebang', () => {
    const content = readFileSync(join(process.cwd(), 'dist', 'cli.js'), 'utf-8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('node dist/cli.js --version prints version and exits 0', () => {
    const output = execFileSync(process.execPath, ['dist/cli.js', '--version'], {
      encoding: 'utf-8',
    }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('TypeScript strict mode (INF-02)', () => {
  it('tsc --noEmit succeeds', () => {
    expect(() => runBin('typescript', ['--noEmit'], 'tsc')).not.toThrow();
  });
});
