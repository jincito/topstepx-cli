import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock modules before import
vi.mock('../../src/api/accounts.js', () => ({
  searchAccounts: vi.fn(),
}));

vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

import { createAccountCommand } from '../../src/commands/account.js';
import { searchAccounts } from '../../src/api/accounts.js';
import { loadToken } from '../../src/auth/token.js';
import { ValidationError, ApiError } from '../../src/errors/index.js';

const mockSearchAccounts = vi.mocked(searchAccounts);
const mockLoadToken = vi.mocked(loadToken);

const MOCK_ACCOUNTS = [
  { id: 100001, name: 'Demo Account', balance: 50000, canTrade: true, isVisible: true, simulated: false },
  { id: 100002, name: 'Eval Account', balance: 150000, canTrade: false, isVisible: true, simulated: true },
];

describe('accountCommand', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('renders detail view for matching account id', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });
    mockSearchAccounts.mockResolvedValue({
      accounts: MOCK_ACCOUNTS,
      success: true,
    });

    const cmd = createAccountCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['account', '100001', '--no-color'], { from: 'user' });

    expect(mockSearchAccounts).toHaveBeenCalledWith('test-jwt');

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(output).toContain('ID');
    expect(output).toContain('100001');
    expect(output).toContain('Name');
    expect(output).toContain('Demo Account');
    expect(output).toContain('Balance');
    expect(output).toContain('Can Trade');
    expect(output).toContain('Yes');
  });

  it('throws ValidationError for non-numeric id', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });

    const cmd = createAccountCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await expect(
      program.parseAsync(['account', 'abc'], { from: 'user' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ApiError when account id not found', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });
    mockSearchAccounts.mockResolvedValue({
      accounts: MOCK_ACCOUNTS,
      success: true,
    });

    const cmd = createAccountCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await expect(
      program.parseAsync(['account', '999999'], { from: 'user' }),
    ).rejects.toThrow(ApiError);
  });
});
