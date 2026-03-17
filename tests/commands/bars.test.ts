import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock modules before import
vi.mock('../../src/api/history.js', () => ({
  retrieveBars: vi.fn(),
  parseInterval: vi.fn(),
}));

vi.mock('../../src/auth/token.js', () => ({
  loadToken: vi.fn(),
}));

vi.mock('../../src/services/symbol-resolver.js', () => ({
  resolveSymbol: vi.fn(),
}));

import { createBarsCommand } from '../../src/commands/bars.js';
import { retrieveBars, parseInterval } from '../../src/api/history.js';
import { loadToken } from '../../src/auth/token.js';
import { resolveSymbol } from '../../src/services/symbol-resolver.js';
import { AuthError } from '../../src/errors/index.js';
import { BarTimeUnit } from '../../src/types/enums.js';

const mockRetrieveBars = vi.mocked(retrieveBars);
const mockParseInterval = vi.mocked(parseInterval);
const mockLoadToken = vi.mocked(loadToken);
const mockResolveSymbol = vi.mocked(resolveSymbol);

const MOCK_BARS = [
  { t: '2026-03-14T09:30:00.000Z', o: 5200.25, h: 5205.50, l: 5199.00, c: 5203.75, v: 12500 },
  { t: '2026-03-14T09:35:00.000Z', o: 5203.75, h: 5210.00, l: 5201.25, c: 5208.50, v: 8700 },
  { t: '2026-03-14T09:40:00.000Z', o: 5208.50, h: 5212.25, l: 5206.00, c: 5211.00, v: 9300 },
];

function setupProgram(): { program: Command; cmd: Command } {
  const cmd = createBarsCommand();
  const program = new Command();
  program
    .option('--json', 'JSON output')
    .option('--no-color', 'No color')
    .option('--verbose', 'Verbose');
  program.addCommand(cmd);
  return { program, cmd };
}

function setupDefaults(): void {
  mockLoadToken.mockReturnValue({
    token: 'test-jwt',
    acquiredAt: '2026-03-14T00:00:00.000Z',
    expiresAt: '2026-03-15T00:00:00.000Z',
    username: 'user1',
  });
  mockResolveSymbol.mockResolvedValue('CON.F.US.EP.U25');
  mockParseInterval.mockReturnValue({ unit: BarTimeUnit.Minute, unitNumber: 5 });
  mockRetrieveBars.mockResolvedValue({
    bars: MOCK_BARS,
    success: true,
  });
}

describe('barsCommand', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('is a Commander Command with name "bars"', () => {
    const cmd = createBarsCommand();
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('bars');
  });

  it('resolves symbol via resolveSymbol before fetching', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['bars', 'ES', '--no-color'], { from: 'user' });

    expect(mockResolveSymbol).toHaveBeenCalledWith('ES', 'test-jwt');
    expect(mockRetrieveBars).toHaveBeenCalled();
    // Verify contractId in the bars call matches resolved symbol
    const barsCall = mockRetrieveBars.mock.calls[0];
    expect(barsCall[1].contractId).toBe('CON.F.US.EP.U25');
  });

  it('defaults to 20 bars with 5m interval when no flags given', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['bars', 'ES', '--no-color'], { from: 'user' });

    expect(mockParseInterval).toHaveBeenCalledWith('5m');
    const barsCall = mockRetrieveBars.mock.calls[0];
    expect(barsCall[1].limit).toBe(20);
  });

  it('respects --interval flag', async () => {
    setupDefaults();
    mockParseInterval.mockReturnValue({ unit: BarTimeUnit.Hour, unitNumber: 1 });
    const { program } = setupProgram();

    await program.parseAsync(['bars', 'ES', '--interval', '1h', '--no-color'], { from: 'user' });

    expect(mockParseInterval).toHaveBeenCalledWith('1h');
    const barsCall = mockRetrieveBars.mock.calls[0];
    expect(barsCall[1].unit).toBe(BarTimeUnit.Hour);
    expect(barsCall[1].unitNumber).toBe(1);
  });

  it('respects --count flag for limiting result count', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['bars', 'ES', '--count', '50', '--no-color'], { from: 'user' });

    const barsCall = mockRetrieveBars.mock.calls[0];
    expect(barsCall[1].limit).toBe(50);
  });

  it('respects --from and --to date flags', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(
      ['bars', 'ES', '--from', '2026-03-01', '--to', '2026-03-14', '--no-color'],
      { from: 'user' },
    );

    const barsCall = mockRetrieveBars.mock.calls[0];
    // from should become a start-of-day ISO string
    expect(barsCall[1].startTime).toContain('2026-03-01');
    // to should become an ISO string
    expect(barsCall[1].endTime).toContain('2026-03-14');
  });

  it('displays Time, Open, High, Low, Close, Volume columns', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['bars', 'ES', '--no-color'], { from: 'user' });

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(output).toContain('Time');
    expect(output).toContain('Open');
    expect(output).toContain('High');
    expect(output).toContain('Low');
    expect(output).toContain('Close');
    expect(output).toContain('Volume');
    // Check actual data values appear
    expect(output).toContain('5200.25');
    expect(output).toContain('12500');
  });

  it('outputs valid JSON array with --json flag', async () => {
    setupDefaults();
    const { program } = setupProgram();

    await program.parseAsync(['bars', 'ES', '--json'], { from: 'user' });

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);
    expect(parsed[0]).toHaveProperty('open', 5200.25);
    expect(parsed[0]).toHaveProperty('high', 5205.50);
    expect(parsed[0]).toHaveProperty('low', 5199.00);
    expect(parsed[0]).toHaveProperty('close', 5203.75);
    expect(parsed[0]).toHaveProperty('volume', 12500);
    expect(parsed[0]).toHaveProperty('time');
  });

  it('throws AuthError when not authenticated', async () => {
    mockLoadToken.mockReturnValue(null);
    const { program } = setupProgram();

    await expect(
      program.parseAsync(['bars', 'ES'], { from: 'user' }),
    ).rejects.toThrow(AuthError);
  });

  it('shows "No bars returned" message when API returns empty array', async () => {
    setupDefaults();
    mockRetrieveBars.mockResolvedValue({
      bars: [],
      success: true,
    });
    const { program } = setupProgram();

    await program.parseAsync(['bars', 'ES', '--no-color'], { from: 'user' });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('No bars returned');
  });
});
