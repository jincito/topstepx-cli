import { describe, it, expect } from 'vitest';
import { theme, ansis } from '../../src/output/colors.js';

describe('colors', () => {
  describe('theme', () => {
    const expectedKeys = ['header', 'success', 'error', 'warning', 'muted', 'value', 'label'];

    it('has all semantic keys', () => {
      for (const key of expectedKeys) {
        expect(theme).toHaveProperty(key);
      }
    });

    it('each theme value is callable and returns a string', () => {
      for (const key of expectedKeys) {
        const fn = theme[key as keyof typeof theme];
        const result = fn('test');
        expect(typeof result).toBe('string');
      }
    });

    it('theme functions wrap text (result contains the input text)', () => {
      for (const key of expectedKeys) {
        const fn = theme[key as keyof typeof theme];
        const result = fn('hello');
        expect(result).toContain('hello');
      }
    });
  });

  describe('ansis re-export', () => {
    it('ansis is re-exported from colors module', () => {
      expect(ansis).toBeDefined();
      expect(typeof ansis.strip).toBe('function');
    });
  });
});
