import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// We mock os.homedir() so tests don't pollute the real home directory
vi.mock('node:os', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:os')>();
  return {
    ...original,
    homedir: vi.fn(),
  };
});

// Import after mock setup
import { homedir } from 'node:os';
import { getConfigDir, ensureConfigDir } from '../../src/config/paths.js';

const mockedHomedir = vi.mocked(homedir);

describe('getConfigDir', () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'topstepx-test-'));
    mockedHomedir.mockReturnValue(tempHome);
  });

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  it('returns a path containing .config and topstepx', () => {
    const dir = getConfigDir();
    expect(dir).toContain('.config');
    expect(dir).toContain('topstepx');
  });

  it('returns a path under the home directory', () => {
    const dir = getConfigDir();
    expect(dir).toBe(join(tempHome, '.config', 'topstepx'));
  });

  it('uses os.homedir() (not process.env.HOME)', () => {
    getConfigDir();
    expect(mockedHomedir).toHaveBeenCalled();
  });
});

describe('ensureConfigDir', () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'topstepx-test-'));
    mockedHomedir.mockReturnValue(tempHome);
  });

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  it('creates the config directory if it does not exist', () => {
    const dir = ensureConfigDir();
    expect(existsSync(dir)).toBe(true);
  });

  it('is idempotent (calling twice does not throw)', () => {
    ensureConfigDir();
    expect(() => ensureConfigDir()).not.toThrow();
  });

  it('returns the config directory path', () => {
    const dir = ensureConfigDir();
    expect(dir).toBe(join(tempHome, '.config', 'topstepx'));
  });

  it('creates nested directories (.config/topstepx)', () => {
    const dir = ensureConfigDir();
    expect(existsSync(join(tempHome, '.config'))).toBe(true);
    expect(existsSync(dir)).toBe(true);
  });
});
