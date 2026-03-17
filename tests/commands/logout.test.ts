import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the auth module
const mockStoreSave = vi.fn();
const mockStoreClear = vi.fn();
const mockStoreLoad = vi.fn();

vi.mock('../../src/auth/index.js', () => {
  class MockCredentialStore {
    save = mockStoreSave;
    clear = mockStoreClear;
    load = mockStoreLoad;
  }
  return {
    CredentialStore: MockCredentialStore,
    clearToken: vi.fn(),
    saveToken: vi.fn(),
    loadToken: vi.fn(),
    login: vi.fn(),
    refreshToken: vi.fn(),
    promptCredentials: vi.fn(),
    decodeJwtPayload: vi.fn(),
    API_BASE_URL: 'https://api.topstepx.com/api',
  };
});

// Mock the output module
vi.mock('../../src/output/index.js', () => ({
  verbose: vi.fn(),
  setVerbose: vi.fn(),
  output: vi.fn(),
  theme: {
    success: (s: string) => s,
    error: (s: string) => s,
    muted: (s: string) => s,
    header: (s: string) => s,
    warning: (s: string) => s,
    value: (s: string) => s,
    label: (s: string) => s,
  },
  ansis: { green: (s: string) => s, red: (s: string) => s },
}));

import { createLogoutCommand } from '../../src/commands/logout.js';
import { clearToken } from '../../src/auth/index.js';

const mockClearToken = vi.mocked(clearToken);

describe('logoutCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('is a Commander Command with name "logout"', () => {
    const cmd = createLogoutCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('logout');
  });

  it('calls clear() and clearToken()', async () => {
    const cmd = createLogoutCommand();
    const program = new Command();
    program.addCommand(cmd);
    await program.parseAsync(['logout'], { from: 'user' });

    // CredentialStore.clear was called
    expect(mockStoreClear).toHaveBeenCalledOnce();

    // clearToken was called
    expect(mockClearToken).toHaveBeenCalledOnce();
  });

  it('prints confirmation message', async () => {
    const cmd = createLogoutCommand();
    const program = new Command();
    program.addCommand(cmd);
    await program.parseAsync(['logout'], { from: 'user' });

    const logOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(logOutput).toContain('logged out');
  });

  it('works even when nothing is stored (clear does not throw)', async () => {
    const cmd = createLogoutCommand();
    const program = new Command();
    program.addCommand(cmd);

    // Should not throw
    await expect(
      program.parseAsync(['logout'], { from: 'user' }),
    ).resolves.not.toThrow();
  });
});
