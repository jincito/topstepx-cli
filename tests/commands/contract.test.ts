import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock modules before import
vi.mock('../../src/api/contracts.js', () => ({
  getContractById: vi.fn(),
}));

vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

import { createContractCommand } from '../../src/commands/contract.js';
import { getContractById } from '../../src/api/contracts.js';
import { loadToken } from '../../src/auth/token.js';
import { AuthError } from '../../src/errors/index.js';

const mockGetContractById = vi.mocked(getContractById);
const mockLoadToken = vi.mocked(loadToken);

const MOCK_CONTRACT = {
  id: 'CON.F.US.EP.U25',
  name: 'ESU5',
  description: 'E-mini S&P 500: September 2025',
  tickSize: 0.25,
  tickValue: 12.5,
  activeContract: true,
  symbolId: 'F.US.EP',
};

describe('contractCommand', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('is a Commander Command with name "contract"', () => {
    const cmd = createContractCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('contract');
  });

  it('renders detail view with all contract fields', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });
    mockGetContractById.mockResolvedValue({
      contract: MOCK_CONTRACT,
      success: true,
    });

    const cmd = createContractCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['contract', 'CON.F.US.EP.U25', '--no-color'], { from: 'user' });

    expect(mockGetContractById).toHaveBeenCalledWith('test-jwt', 'CON.F.US.EP.U25');

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(output).toContain('ID');
    expect(output).toContain('CON.F.US.EP.U25');
    expect(output).toContain('Name');
    expect(output).toContain('ESU5');
    expect(output).toContain('Description');
    expect(output).toContain('E-mini S&P 500: September 2025');
    expect(output).toContain('Symbol ID');
    expect(output).toContain('F.US.EP');
    expect(output).toContain('Tick Size');
    expect(output).toContain('0.25');
    expect(output).toContain('Tick Value');
    expect(output).toContain('12.5');
    expect(output).toContain('Active');
    expect(output).toContain('Yes');
  });

  it('passes correct contractId to API', async () => {
    mockLoadToken.mockReturnValue({ token: 'test-jwt', username: 'user1' });
    mockGetContractById.mockResolvedValue({
      contract: MOCK_CONTRACT,
      success: true,
    });

    const cmd = createContractCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await program.parseAsync(['contract', 'CON.F.US.ENQ.U25', '--no-color'], { from: 'user' });

    expect(mockGetContractById).toHaveBeenCalledWith('test-jwt', 'CON.F.US.ENQ.U25');
  });

  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);

    const cmd = createContractCommand();
    const program = new Command();
    program
      .option('--json', 'JSON output')
      .option('--no-color', 'No color')
      .option('--verbose', 'Verbose');
    program.addCommand(cmd);

    await expect(
      program.parseAsync(['contract', 'CON.F.US.EP.U25'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });
});
