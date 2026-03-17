import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the output module so theme returns identity functions (no ANSI codes in tests)
vi.mock('../../src/output/index.js', () => ({
  theme: {
    error: vi.fn((s: string) => s),
    muted: vi.fn((s: string) => s),
    warning: vi.fn((s: string) => s),
  },
}));

import { renderError, printError } from '../../src/api/error-renderer.js';
import { ApiError } from '../../src/errors/api-error.js';
import { AuthError } from '../../src/errors/auth-error.js';
import { NetworkError } from '../../src/errors/network-error.js';

describe('api/error-renderer', () => {
  describe('renderError', () => {
    it('returns message with "API Error:" prefix for ApiError', () => {
      const err = new ApiError('Something went wrong', 500);
      const result = renderError(err);
      expect(result.message).toBe('API Error: Something went wrong');
    });

    it('returns session expired guidance for ApiError with errorCode 401', () => {
      const err = new ApiError('Unauthorized', 401);
      const result = renderError(err);
      expect(result.guidance).toBe('Session expired. Run: topstep login');
    });

    it('returns rate limit guidance for ApiError with errorCode 429', () => {
      const err = new ApiError('Too many requests', 429);
      const result = renderError(err);
      expect(result.guidance).toBe('Rate limited. Wait a moment and retry.');
    });

    it('returns generic guidance for ApiError with unknown errorCode', () => {
      const err = new ApiError('Server error', 500);
      const result = renderError(err);
      expect(result.guidance).toBe('Check the error message above and try again.');
    });

    it('returns error message and login guidance for AuthError', () => {
      const err = new AuthError('Not authenticated');
      const result = renderError(err);
      expect(result.message).toBe('Not authenticated');
      expect(result.guidance).toBe('Run: topstep login');
    });

    it('returns message with "Network Error:" prefix and connection guidance for NetworkError', () => {
      const err = new NetworkError('Connection refused');
      const result = renderError(err);
      expect(result.message).toBe('Network Error: Connection refused');
      expect(result.guidance).toBe('Check your internet connection and try again.');
    });

    it('returns message and generic guidance for generic Error', () => {
      const err = new Error('Something broke');
      const result = renderError(err);
      expect(result.message).toBe('Something broke');
      expect(result.guidance).toBe('An unexpected error occurred.');
    });

    it('returns string representation and generic guidance for non-Error values', () => {
      const result = renderError('raw string error');
      expect(result.message).toBe('raw string error');
      expect(result.guidance).toBe('An unexpected error occurred.');
    });
  });

  describe('printError', () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('writes colored message to stderr in human mode', () => {
      const err = new AuthError('Not authenticated');
      printError(err);

      expect(stderrSpy).toHaveBeenCalledTimes(2);
      // First call: the error message
      expect(stderrSpy.mock.calls[0][0]).toBe('Not authenticated');
      // Second call: the guidance
      expect(stderrSpy.mock.calls[1][0]).toBe('Run: topstep login');
      // Should NOT write to stdout
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('writes JSON object to stdout in JSON mode', () => {
      const err = new ApiError('Bad request', 400);
      printError(err, true);

      expect(stdoutSpy).toHaveBeenCalledOnce();
      // Should NOT write to stderr
      expect(stderrSpy).not.toHaveBeenCalled();

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain('"error"');
      expect(output).toContain('"code"');
      expect(output).toContain('"message"');
      expect(output).toContain('"guidance"');
    });

    it('produces valid JSON parseable by JSON.parse in JSON mode', () => {
      const err = new ApiError('Server error', 500);
      printError(err, true);

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe('API_ERROR');
      expect(parsed.error.message).toBe('API Error: Server error');
      expect(parsed.error.guidance).toBe('Check the error message above and try again.');
    });
  });
});
