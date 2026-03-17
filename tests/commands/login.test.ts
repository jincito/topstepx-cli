import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock the auth module
const mockSave = vi.fn();
const mockClear = vi.fn();
const mockLoad = vi.fn();

vi.mock('../../src/auth/index.js', () => {
  class MockCredentialStore {
    save = mockSave;
    clear = mockClear;
    load = mockLoad;
  }
  return {
    promptCredentials: vi.fn(),
    login: vi.fn(),
    CredentialStore: MockCredentialStore,
    saveToken: vi.fn(),
    decodeJwtPayload: vi.fn(),
    clearToken: vi.fn(),
    loadToken: vi.fn(),
    refreshToken: vi.fn(),
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

import { createLoginCommand } from '../../src/commands/login.js';
import {
  promptCredentials,
  login,
  saveToken,
  decodeJwtPayload,
  CredentialStore,
} from '../../src/auth/index.js';
import { AuthError } from '../../src/errors/auth-error.js';

const mockPromptCredentials = vi.mocked(promptCredentials);
const mockLogin = vi.mocked(login);
const mockSaveToken = vi.mocked(saveToken);
const mockDecodeJwt = vi.mocked(decodeJwtPayload);

describe('loginCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('is a Commander Command with name "login"', () => {
    const cmd = createLoginCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('login');
  });

  it('has a description', () => {
    const cmd = createLoginCommand();
    expect(cmd.description()).toBeTruthy();
  });

  it('successful login calls save + saveToken + prints success', async () => {
    mockPromptCredentials.mockResolvedValueOnce({
      username: 'testuser',
      apiKey: 'api-key-123',
    });
    mockLogin.mockResolvedValueOnce('jwt.payload.signature');
    mockDecodeJwt.mockReturnValueOnce({
      exp: Math.floor(Date.now() / 1000) + 86400,
      iat: Math.floor(Date.now() / 1000),
    });

    const cmd = createLoginCommand();
    const program = new Command();
    program.addCommand(cmd);
    await program.parseAsync(['login'], { from: 'user' });

    // CredentialStore.save was called
    expect(mockSave).toHaveBeenCalledWith({
      username: 'testuser',
      apiKey: 'api-key-123',
    });

    // saveToken was called with correct cache
    expect(mockSaveToken).toHaveBeenCalledOnce();
    const tokenArg = mockSaveToken.mock.calls[0][0];
    expect(tokenArg.token).toBe('jwt.payload.signature');
    expect(tokenArg.username).toBe('testuser');

    // Success message printed
    const logOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(logOutput).toContain('testuser');
  });

  it('failed login (AuthError) prints error message and does not crash', async () => {
    mockPromptCredentials.mockResolvedValueOnce({
      username: 'testuser',
      apiKey: 'bad-key',
    });
    mockLogin.mockRejectedValueOnce(
      new AuthError('Login failed: Invalid API key', { errorCode: 401 }),
    );

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const cmd = createLoginCommand();
    const program = new Command();
    program.addCommand(cmd);
    await program.parseAsync(['login'], { from: 'user' });

    // Should have printed error, not thrown
    const errOutput = errSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(errOutput).toContain('Login failed');

    errSpy.mockRestore();
  });
});
