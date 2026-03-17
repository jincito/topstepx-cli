import { describe, it, expect } from 'vitest';
import {
  determineOrderType,
  buildBrackets,
  validateQuantity,
  formatConfirmMessage,
} from '../../src/services/order-builder.js';
import { OrderType, OrderSide } from '../../src/types/enums.js';
import { ValidationError } from '../../src/errors/index.js';

describe('services/order-builder', () => {
  describe('determineOrderType', () => {
    it('returns Market type with null prices when no flags are set', () => {
      const result = determineOrderType({});
      expect(result.type).toBe(OrderType.Market);
      expect(result.limitPrice).toBeNull();
      expect(result.stopPrice).toBeNull();
    });

    it('returns Limit type with parsed limitPrice when --limit is set', () => {
      const result = determineOrderType({ limit: '5500' });
      expect(result.type).toBe(OrderType.Limit);
      expect(result.limitPrice).toBe(5500);
      expect(result.stopPrice).toBeNull();
    });

    it('returns Stop type with parsed stopPrice when --stop is set', () => {
      const result = determineOrderType({ stop: '5400' });
      expect(result.type).toBe(OrderType.Stop);
      expect(result.limitPrice).toBeNull();
      expect(result.stopPrice).toBe(5400);
    });

    it('returns StopLimit type with both prices when --stopLimit is set', () => {
      const result = determineOrderType({ stopLimit: ['5400', '5395'] });
      expect(result.type).toBe(OrderType.StopLimit);
      expect(result.stopPrice).toBe(5400);
      expect(result.limitPrice).toBe(5395);
    });

    it('throws ValidationError when both --limit and --stop are set', () => {
      expect(() => determineOrderType({ limit: '5500', stop: '5400' })).toThrow(
        ValidationError,
      );
    });

    it('throws ValidationError when both --limit and --stopLimit are set', () => {
      expect(() =>
        determineOrderType({ limit: '5500', stopLimit: ['5400', '5395'] }),
      ).toThrow(ValidationError);
    });

    it('throws ValidationError when both --stop and --stopLimit are set', () => {
      expect(() =>
        determineOrderType({ stop: '5400', stopLimit: ['5400', '5395'] }),
      ).toThrow(ValidationError);
    });

    it('error message mentions conflicting flags', () => {
      try {
        determineOrderType({ limit: '5500', stop: '5400' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as Error).message).toContain(
          'Only one of --limit, --stop, or --stop-limit',
        );
      }
    });
  });

  describe('buildBrackets', () => {
    it('returns null brackets when no argument is provided', () => {
      const result = buildBrackets(undefined);
      expect(result.stopLossBracket).toBeNull();
      expect(result.takeProfitBracket).toBeNull();
    });

    it('returns bracket objects with ticks and type: OrderType.Limit', () => {
      const result = buildBrackets(['10', '20']);
      expect(result.stopLossBracket).toEqual({
        ticks: 10,
        type: OrderType.Limit,
      });
      expect(result.takeProfitBracket).toEqual({
        ticks: 20,
        type: OrderType.Limit,
      });
    });

    it('throws ValidationError for zero stop-loss ticks', () => {
      expect(() => buildBrackets(['0', '20'])).toThrow(ValidationError);
    });

    it('throws ValidationError for negative stop-loss ticks', () => {
      expect(() => buildBrackets(['-5', '20'])).toThrow(ValidationError);
    });

    it('throws ValidationError for NaN stop-loss ticks', () => {
      expect(() => buildBrackets(['abc', '20'])).toThrow(ValidationError);
    });

    it('throws ValidationError for zero take-profit ticks', () => {
      expect(() => buildBrackets(['10', '0'])).toThrow(ValidationError);
    });

    it('throws ValidationError for negative take-profit ticks', () => {
      expect(() => buildBrackets(['10', '-3'])).toThrow(ValidationError);
    });

    it('throws ValidationError for NaN take-profit ticks', () => {
      expect(() => buildBrackets(['10', 'xyz'])).toThrow(ValidationError);
    });

    it('returns null brackets when array has fewer than 2 elements', () => {
      const result = buildBrackets(['10']);
      expect(result.stopLossBracket).toBeNull();
      expect(result.takeProfitBracket).toBeNull();
    });
  });

  describe('validateQuantity', () => {
    it('returns 1 for input "1"', () => {
      expect(validateQuantity('1')).toBe(1);
    });

    it('returns 10 for input "10"', () => {
      expect(validateQuantity('10')).toBe(10);
    });

    it('throws ValidationError for "0"', () => {
      expect(() => validateQuantity('0')).toThrow(ValidationError);
    });

    it('throws ValidationError for "-1"', () => {
      expect(() => validateQuantity('-1')).toThrow(ValidationError);
    });

    it('throws ValidationError for "1.5" (non-integer)', () => {
      expect(() => validateQuantity('1.5')).toThrow(ValidationError);
    });

    it('throws ValidationError for "abc"', () => {
      expect(() => validateQuantity('abc')).toThrow(ValidationError);
    });

    it('error message mentions the field is quantity', () => {
      try {
        validateQuantity('abc');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).field).toBe('quantity');
      }
    });
  });

  describe('formatConfirmMessage', () => {
    it('produces "Place BUY 1 ES (Market)?" for market buy', () => {
      const msg = formatConfirmMessage(
        OrderSide.Bid,
        1,
        'ES',
        OrderType.Market,
        null,
        null,
        null,
        null,
      );
      expect(msg).toBe('Place BUY 1 ES (Market)?');
    });

    it('includes "@ 5500" for limit orders', () => {
      const msg = formatConfirmMessage(
        OrderSide.Bid,
        1,
        'ES',
        OrderType.Limit,
        5500,
        null,
        null,
        null,
      );
      expect(msg).toContain('@ 5500');
    });

    it('includes "stop 5400" for stop orders', () => {
      const msg = formatConfirmMessage(
        OrderSide.Ask,
        2,
        'NQ',
        OrderType.Stop,
        null,
        5400,
        null,
        null,
      );
      expect(msg).toContain('stop 5400');
    });

    it('includes bracket info when brackets present', () => {
      const msg = formatConfirmMessage(
        OrderSide.Bid,
        1,
        'ES',
        OrderType.Market,
        null,
        null,
        10,
        20,
      );
      expect(msg).toContain('[SL: 10 ticks, TP: 20 ticks]');
    });

    it('formats SELL side correctly', () => {
      const msg = formatConfirmMessage(
        OrderSide.Ask,
        3,
        'NQ',
        OrderType.Market,
        null,
        null,
        null,
        null,
      );
      expect(msg).toBe('Place SELL 3 NQ (Market)?');
    });

    it('includes both limit price and brackets when both present', () => {
      const msg = formatConfirmMessage(
        OrderSide.Bid,
        1,
        'ES',
        OrderType.Limit,
        5500,
        null,
        10,
        20,
      );
      expect(msg).toContain('@ 5500');
      expect(msg).toContain('[SL: 10 ticks, TP: 20 ticks]');
      expect(msg.endsWith('?')).toBe(true);
    });

    it('includes both stop and limit prices for StopLimit orders', () => {
      const msg = formatConfirmMessage(
        OrderSide.Bid,
        1,
        'ES',
        OrderType.StopLimit,
        5395,
        5400,
        null,
        null,
      );
      expect(msg).toContain('@ 5395');
      expect(msg).toContain('stop 5400');
    });
  });
});
