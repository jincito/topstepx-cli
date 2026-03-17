import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('README.md (INF-06)', () => {
  it('README.md exists at project root', () => {
    expect(existsSync('README.md')).toBe(true);
  });

  it('has install section with npm install command', () => {
    const content = readFileSync('README.md', 'utf-8');
    expect(content).toContain('npm install -g topstepx-cli');
  });

  it('has authentication section with login command', () => {
    const content = readFileSync('README.md', 'utf-8');
    expect(content).toContain('topstep login');
  });

  it('has account management examples', () => {
    const content = readFileSync('README.md', 'utf-8');
    expect(content).toContain('topstep accounts');
  });

  it('has market data examples', () => {
    const content = readFileSync('README.md', 'utf-8');
    expect(content).toContain('topstep quotes');
    expect(content).toContain('topstep bars');
  });

  it('has order placement examples', () => {
    const content = readFileSync('README.md', 'utf-8');
    expect(content).toContain('topstep buy');
    expect(content).toContain('topstep sell');
  });

  it('has order and position management examples', () => {
    const content = readFileSync('README.md', 'utf-8');
    expect(content).toContain('topstep orders');
    expect(content).toContain('topstep positions');
  });

  it('has streaming examples', () => {
    const content = readFileSync('README.md', 'utf-8');
    expect(content).toContain('topstep watch');
    expect(content).toContain('topstep monitor');
  });

  it('has global flags documentation', () => {
    const content = readFileSync('README.md', 'utf-8');
    expect(content).toContain('--json');
    expect(content).toContain('--verbose');
    expect(content).toContain('--no-color');
    expect(content).toContain('--account');
  });
});

describe('npm pack readiness', () => {
  it('npm pack --dry-run includes README.md', () => {
    const result = spawnSync('npm', ['pack', '--dry-run'], {
      encoding: 'utf-8',
      cwd: process.cwd(),
      shell: true,
    });
    // npm sends the file listing to stderr as "npm notice" lines
    const combined = (result.stdout ?? '') + (result.stderr ?? '');
    expect(combined).toContain('README.md');
  });
});
