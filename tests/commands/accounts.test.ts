import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock modules before import
vi.mock('../../src/api/accounts.js', () => ({
  searchAccounts: vi.fn(),
}));

vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

import { createAccountsCommand } from '../../src/commands/accounts.js';
import { searchAccounts } from '../../src/api/accounts.js';
import { loadToken } from '../../src/auth/token.js';
import { AuthError } from '../../src/errors/index.js';

const mockSearchAccounts = vi.mocked(searchAccounts);
const mockLoadToken = vi.mocked(loadToken);

const MOCK_ACCOUNTS = [
  { id: 100001, name: 'Demo Account', balance: 50000, canTrade: true, isVisible: true, simulated: false },
  { id: 100002, name: 'Eval Account', balance: 150000, canTrade: true, isVisible: true, simulated: true },
];

describe('accountsCommand', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('is a Commander Command with name "accounts"', () => {
    const cmd = createAccountsCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('accounts');
  });

  it('calls searchAccounts with token and renders table', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });
    mockSearchAccounts.mockResolvedValue({
      accounts: MOCK_ACCOUNTS,
      success: true,
    });

    const cmd = createAccountsCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['accounts', '--no-color'], { from: 'user' });

    expect(mockLoadToken).toHaveBeenCalled();
    expect(mockSearchAccounts).toHaveBeenCalledWith('test-jwt', true);

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(output).toContain('ID');
    expect(output).toContain('Name');
    expect(output).toContain('Balance');
    expect(output).toContain('Can Trade');
    expect(output).toContain('Demo Account');
    expect(output).toContain('Yes');
  });

  it('produces valid JSON array with --json flag', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });
    mockSearchAccounts.mockResolvedValue({
      accounts: MOCK_ACCOUNTS,
      success: true,
    });

    const cmd = createAccountsCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['accounts', '--json'], { from: 'user' });

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed[0]).toHaveProperty('id', 100001);
    expect(parsed[0]).toHaveProperty('name', 'Demo Account');
    expect(parsed[0]).toHaveProperty('balance', 50000);
    expect(parsed[0]).toHaveProperty('canTrade', true);
  });

  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);

    const cmd = createAccountsCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await expect(
      program.parseAsync(['accounts'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });
});
