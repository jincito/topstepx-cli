import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setVerbose, verbose } from '../../src/output/logger.js';

describe('logger', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setVerbose(false);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('verbose() produces no output when verbose mode is off (default)', () => {
    verbose('test label');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('verbose(label) writes timestamped message to stderr after setVerbose(true)', () => {
    setVerbose(true);
    verbose('test label');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0] as string;
    // Should contain ISO timestamp pattern [YYYY-MM-DDTHH:mm:ss...Z]
    expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(output).toContain('test label');
  });

  it('verbose(label, objectData) includes JSON-stringified data in output', () => {
    setVerbose(true);
    const data = { key: 'value', num: 42 };
    verbose('data label', data);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0].join(' ');
    expect(output).toContain('data label');
    expect(output).toContain('"key"');
    expect(output).toContain('"value"');
  });

  it('verbose(label, stringData) includes the string directly', () => {
    setVerbose(true);
    verbose('string label', 'some string data');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0].join(' ');
    expect(output).toContain('string label');
    expect(output).toContain('some string data');
  });
});
