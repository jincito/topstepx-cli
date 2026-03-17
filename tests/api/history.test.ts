import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApiPost } = vi.hoisted(() => {
  return { mockApiPost: vi.fn() };
});

vi.mock('../../src/api/client.js', () => ({
  apiPost: mockApiPost,
}));

import { parseInterval, retrieveBars } from '../../src/api/history.js';
import { BarTimeUnit } from '../../src/types/enums.js';
import { ValidationError } from '../../src/errors/index.js';

describe('api/history', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  describe('parseInterval', () => {
    it('parses "1m" to Minute unit with unitNumber 1', () => {
      const result = parseInterval('1m');
      expect(result).toEqual({ unit: BarTimeUnit.Minute, unitNumber: 1 });
    });

    it('parses "5m" to Minute unit with unitNumber 5', () => {
      const result = parseInterval('5m');
      expect(result).toEqual({ unit: BarTimeUnit.Minute, unitNumber: 5 });
    });

    it('parses "15m" to Minute unit with unitNumber 15', () => {
      const result = parseInterval('15m');
      expect(result).toEqual({ unit: BarTimeUnit.Minute, unitNumber: 15 });
    });

    it('parses "30m" to Minute unit with unitNumber 30', () => {
      const result = parseInterval('30m');
      expect(result).toEqual({ unit: BarTimeUnit.Minute, unitNumber: 30 });
    });

    it('parses "1h" to Hour unit with unitNumber 1', () => {
      const result = parseInterval('1h');
      expect(result).toEqual({ unit: BarTimeUnit.Hour, unitNumber: 1 });
    });

    it('parses "4h" to Hour unit with unitNumber 4', () => {
      const result = parseInterval('4h');
      expect(result).toEqual({ unit: BarTimeUnit.Hour, unitNumber: 4 });
    });

    it('parses "1d" to Day unit with unitNumber 1', () => {
      const result = parseInterval('1d');
      expect(result).toEqual({ unit: BarTimeUnit.Day, unitNumber: 1 });
    });

    it('parses "1w" to Week unit with unitNumber 1', () => {
      const result = parseInterval('1w');
      expect(result).toEqual({ unit: BarTimeUnit.Week, unitNumber: 1 });
    });

    it('parses "1s" to Second unit with unitNumber 1', () => {
      const result = parseInterval('1s');
      expect(result).toEqual({ unit: BarTimeUnit.Second, unitNumber: 1 });
    });

    it('parses "5s" to Second unit with unitNumber 5', () => {
      const result = parseInterval('5s');
      expect(result).toEqual({ unit: BarTimeUnit.Second, unitNumber: 5 });
    });

    it('is case-insensitive ("5M" works like "5m")', () => {
      const result = parseInterval('5M');
      expect(result).toEqual({ unit: BarTimeUnit.Minute, unitNumber: 5 });
    });

    it('is case-insensitive ("1H" works like "1h")', () => {
      const result = parseInterval('1H');
      expect(result).toEqual({ unit: BarTimeUnit.Hour, unitNumber: 1 });
    });

    it('throws ValidationError for invalid interval string', () => {
      expect(() => parseInterval('invalid')).toThrow(ValidationError);
    });

    it('provides a helpful message listing valid intervals when invalid', () => {
      try {
        parseInterval('invalid');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as Error).message).toContain('Invalid interval: "invalid"');
        expect((err as Error).message).toContain('Valid:');
        expect((err as Error).message).toContain('1m');
        expect((err as Error).message).toContain('5m');
        expect((err as Error).message).toContain('1h');
        expect((err as Error).message).toContain('1d');
      }
    });

    it('throws ValidationError for empty string', () => {
      expect(() => parseInterval('')).toThrow(ValidationError);
    });
  });

  describe('retrieveBars', () => {
    it('calls apiPost with /History/retrieveBars path', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        bars: [],
      });

      await retrieveBars('test-token', {
        contractId: 'CON.F.US.EP.U25',
        startTime: '2026-03-01T00:00:00.000Z',
        endTime: '2026-03-14T00:00:00.000Z',
        unit: BarTimeUnit.Minute,
        unitNumber: 5,
        limit: 20,
      });

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost.mock.calls[0][0]).toBe('/History/retrieveBars');
    });

    it('sends correct body shape including live: false', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        bars: [],
      });

      await retrieveBars('test-token', {
        contractId: 'CON.F.US.EP.U25',
        startTime: '2026-03-01T00:00:00.000Z',
        endTime: '2026-03-14T00:00:00.000Z',
        unit: BarTimeUnit.Minute,
        unitNumber: 5,
        limit: 20,
      });

      const body = mockApiPost.mock.calls[0][1];
      expect(body).toEqual({
        contractId: 'CON.F.US.EP.U25',
        startTime: '2026-03-01T00:00:00.000Z',
        endTime: '2026-03-14T00:00:00.000Z',
        unit: BarTimeUnit.Minute,
        unitNumber: 5,
        limit: 20,
        live: false,
        includePartialBar: false,
      });
    });

    it('includes startTime, endTime, unit, unitNumber, and limit in body', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        bars: [],
      });

      await retrieveBars('test-token', {
        contractId: 'CON.F.US.EP.U25',
        startTime: '2026-02-01T00:00:00.000Z',
        endTime: '2026-02-28T00:00:00.000Z',
        unit: BarTimeUnit.Hour,
        unitNumber: 1,
        limit: 50,
      });

      const body = mockApiPost.mock.calls[0][1];
      expect(body.startTime).toBe('2026-02-01T00:00:00.000Z');
      expect(body.endTime).toBe('2026-02-28T00:00:00.000Z');
      expect(body.unit).toBe(BarTimeUnit.Hour);
      expect(body.unitNumber).toBe(1);
      expect(body.limit).toBe(50);
    });

    it('uses /History/ in the path for historyLimiter routing', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        bars: [],
      });

      await retrieveBars('test-token', {
        contractId: 'CON.F.US.EP.U25',
        startTime: '2026-03-01T00:00:00.000Z',
        endTime: '2026-03-14T00:00:00.000Z',
        unit: BarTimeUnit.Minute,
        unitNumber: 5,
        limit: 20,
      });

      const endpoint = mockApiPost.mock.calls[0][0] as string;
      expect(endpoint).toContain('/History/');
    });

    it('defaults includePartialBar to false when not provided', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        bars: [],
      });

      await retrieveBars('test-token', {
        contractId: 'CON.F.US.EP.U25',
        startTime: '2026-03-01T00:00:00.000Z',
        endTime: '2026-03-14T00:00:00.000Z',
        unit: BarTimeUnit.Day,
        unitNumber: 1,
        limit: 10,
      });

      const body = mockApiPost.mock.calls[0][1];
      expect(body.includePartialBar).toBe(false);
    });

    it('passes includePartialBar when explicitly set to true', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        bars: [],
      });

      await retrieveBars('test-token', {
        contractId: 'CON.F.US.EP.U25',
        startTime: '2026-03-01T00:00:00.000Z',
        endTime: '2026-03-14T00:00:00.000Z',
        unit: BarTimeUnit.Day,
        unitNumber: 1,
        limit: 10,
        includePartialBar: true,
      });

      const body = mockApiPost.mock.calls[0][1];
      expect(body.includePartialBar).toBe(true);
    });

    it('passes the token as the third argument to apiPost', async () => {
      mockApiPost.mockResolvedValueOnce({
        success: true,
        bars: [],
      });

      await retrieveBars('my-jwt-token', {
        contractId: 'CON.F.US.EP.U25',
        startTime: '2026-03-01T00:00:00.000Z',
        endTime: '2026-03-14T00:00:00.000Z',
        unit: BarTimeUnit.Minute,
        unitNumber: 5,
        limit: 20,
      });

      expect(mockApiPost.mock.calls[0][2]).toBe('my-jwt-token');
    });

    it('propagates errors from apiPost without wrapping', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        retrieveBars('test-token', {
          contractId: 'CON.F.US.EP.U25',
          startTime: '2026-03-01T00:00:00.000Z',
          endTime: '2026-03-14T00:00:00.000Z',
          unit: BarTimeUnit.Minute,
          unitNumber: 5,
          limit: 20,
        }),
      ).rejects.toThrow('Network error');
    });
  });
});
