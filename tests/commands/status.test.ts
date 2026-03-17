import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the auth module
vi.mock('../../src/auth/index.js', () => ({
  loadToken: vi.fn(),
  decodeJwtPayload: vi.fn(),
  refreshToken: vi.fn(),
  API_BASE_URL: 'https://api.topstepx.com/api',
  login: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
  promptCredentials: vi.fn(),
  CredentialStore: vi.fn(),
}));

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

import { createStatusCommand } from '../../src/commands/status.js';
import {
  loadToken,
  decodeJwtPayload,
  refreshToken,
} from '../../src/auth/index.js';
import { output } from '../../src/output/index.js';

const mockLoadToken = vi.mocked(loadToken);
const mockDecodeJwt = vi.mocked(decodeJwtPayload);
const mockRefreshToken = vi.mocked(refreshToken);
const mockOutput = vi.mocked(output);

describe('statusCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('is a Commander Command with name "status"', () => {
    const cmd = createStatusCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('status');
  });

  it('shows "Not logged in" when no token cached', async () => {
    mockLoadToken.mockReturnValueOnce(null);

    const cmd = createStatusCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);
    await program.parseAsync(['status'], { from: 'user' });

    const logOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(logOutput).toContain('Not logged in');
  });

  it('shows username and token info when logged in', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    mockLoadToken.mockReturnValueOnce({
      token: 'cached.jwt.token',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(futureExp * 1000).toISOString(),
      username: 'testuser',
    });
    mockDecodeJwt.mockReturnValueOnce({
      exp: futureExp,
      iat: Math.floor(Date.now() / 1000),
    });
    mockRefreshToken.mockResolvedValueOnce('refreshed.jwt.token');

    const cmd = createStatusCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);
    await program.parseAsync(['status'], { from: 'user' });

    // output() was called with status rows
    expect(mockOutput).toHaveBeenCalledOnce();
    const rows = mockOutput.mock.calls[0][0] as Record<string, unknown>[];
    const fields = rows.map((r) => r.field);
    expect(fields).toContain('Username');
    expect(fields).toContain('Token Status');
    expect(fields).toContain('API');

    // Username value is correct
    const usernameRow = rows.find((r) => r.field === 'Username');
    expect(usernameRow?.value).toBe('testuser');
  });

  it('shows API unreachable when refreshToken throws', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    mockLoadToken.mockReturnValueOnce({
      token: 'cached.jwt.token',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(futureExp * 1000).toISOString(),
      username: 'testuser',
    });
    mockDecodeJwt.mockReturnValueOnce({
      exp: futureExp,
      iat: Math.floor(Date.now() / 1000),
    });
    mockRefreshToken.mockRejectedValueOnce(new Error('Network error'));

    const cmd = createStatusCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);
    await program.parseAsync(['status'], { from: 'user' });

    expect(mockOutput).toHaveBeenCalledOnce();
    const rows = mockOutput.mock.calls[0][0] as Record<string, unknown>[];
    const apiRow = rows.find((r) => r.field === 'API');
    expect(apiRow?.value).toContain('Unreachable');
  });
});
