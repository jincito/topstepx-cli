import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock modules before import
vi.mock('../../src/api/contracts.js', () => ({
  searchContracts: vi.fn(),
  getAvailableContracts: vi.fn(),
}));

vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

import { createContractsCommand } from '../../src/commands/contracts.js';
import { searchContracts, getAvailableContracts } from '../../src/api/contracts.js';
import { loadToken } from '../../src/auth/token.js';
import { AuthError } from '../../src/errors/index.js';

const mockSearchContracts = vi.mocked(searchContracts);
const mockGetAvailableContracts = vi.mocked(getAvailableContracts);
const mockLoadToken = vi.mocked(loadToken);

const MOCK_CONTRACTS = [
  {
    id: 'CON.F.US.EP.U25',
    name: 'ESU5',
    description: 'E-mini S&P 500: September 2025',
    tickSize: 0.25,
    tickValue: 12.5,
    activeContract: true,
    symbolId: 'F.US.EP',
  },
  {
    id: 'CON.F.US.ENQ.U25',
    name: 'NQU5',
    description: 'E-mini NASDAQ-100: September 2025',
    tickSize: 0.25,
    tickValue: 5,
    activeContract: true,
    symbolId: 'F.US.ENQ',
  },
  {
    id: 'CON.F.US.EP.Z24',
    name: 'ESZ4',
    description: 'E-mini S&P 500: December 2024',
    tickSize: 0.25,
    tickValue: 12.5,
    activeContract: false,
    symbolId: 'F.US.EP',
  },
];

describe('contractsCommand', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('is a Commander Command with name "contracts"', () => {
    const cmd = createContractsCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('contracts');
  });

  it('calls getAvailableContracts when no search argument provided', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });
    mockGetAvailableContracts.mockResolvedValue({
      contracts: MOCK_CONTRACTS,
      success: true,
    });

    const cmd = createContractsCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['contracts', '--no-color'], { from: 'user' });

    expect(mockLoadToken).toHaveBeenCalled();
    expect(mockGetAvailableContracts).toHaveBeenCalledWith('test-jwt');
    expect(mockSearchContracts).not.toHaveBeenCalled();

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(output).toContain('ID');
    expect(output).toContain('Name');
    expect(output).toContain('Description');
    expect(output).toContain('Tick Size');
    expect(output).toContain('Tick Value');
    expect(output).toContain('Active');
    expect(output).toContain('ESU5');
    expect(output).toContain('Yes');
    expect(output).toContain('No');
  });

  it('calls searchContracts when search argument is provided', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });
    mockSearchContracts.mockResolvedValue({
      contracts: [MOCK_CONTRACTS[0]],
      success: true,
    });

    const cmd = createContractsCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['contracts', 'ES', '--no-color'], { from: 'user' });

    expect(mockSearchContracts).toHaveBeenCalledWith('test-jwt', 'ES');
    expect(mockGetAvailableContracts).not.toHaveBeenCalled();

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(output).toContain('ESU5');
  });

  it('produces valid JSON array with --json flag', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });
    mockGetAvailableContracts.mockResolvedValue({
      contracts: MOCK_CONTRACTS,
      success: true,
    });

    const cmd = createContractsCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['contracts', '--json'], { from: 'user' });

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);
    expect(parsed[0]).toHaveProperty('id', 'CON.F.US.EP.U25');
    expect(parsed[0]).toHaveProperty('name', 'ESU5');
    expect(parsed[0]).toHaveProperty('tickSize', 0.25);
    expect(parsed[0]).toHaveProperty('tickValue', 12.5);
  });

  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);

    const cmd = createContractsCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await expect(
      program.parseAsync(['contracts'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });
});
