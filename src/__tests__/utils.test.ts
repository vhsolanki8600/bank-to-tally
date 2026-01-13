import { describe, it, expect } from 'vitest';
import { parseDate, parseAmount, determineDebitCredit, escapeXml, cleanDescription } from '../lib/utils';

describe('Utils', () => {
  describe('parseDate', () => {
    it('should parse DD/MM/YYYY format', () => {
      expect(parseDate('15/06/2024')).toBe('2024-06-15');
      expect(parseDate('01/01/2024')).toBe('2024-01-01');
    });

    it('should parse DD-MM-YYYY format', () => {
      expect(parseDate('15-06-2024')).toBe('2024-06-15');
    });

    it('should handle already correct YYYY-MM-DD format', () => {
      expect(parseDate('2024-06-15')).toBe('2024-06-15');
    });

    it('should handle single digit day/month', () => {
      expect(parseDate('5/6/2024')).toBe('2024-06-05');
    });
  });

  describe('parseAmount', () => {
    it('should parse simple numbers', () => {
      expect(parseAmount('1000')).toBe(1000);
      expect(parseAmount(500)).toBe(500);
    });

    it('should remove commas (Indian format)', () => {
      expect(parseAmount('1,00,000')).toBe(100000);
      expect(parseAmount('50,000.50')).toBe(50000.5);
    });

    it('should remove currency symbols', () => {
      expect(parseAmount('₹5000')).toBe(5000);
      expect(parseAmount('$ 1000')).toBe(1000);
    });

    it('should handle negative amounts', () => {
      expect(parseAmount('-5000')).toBe(5000);
    });

    it('should return 0 for invalid input', () => {
      expect(parseAmount('')).toBe(0);
      expect(parseAmount('abc')).toBe(0);
    });
  });

  describe('determineDebitCredit', () => {
    it('should detect Dr suffix as debit', () => {
      const result = determineDebitCredit('5000 Dr');
      expect(result.debit).toBe(5000);
      expect(result.credit).toBe(0);
    });

    it('should detect Cr suffix as credit', () => {
      const result = determineDebitCredit('5000 Cr');
      expect(result.debit).toBe(0);
      expect(result.credit).toBe(5000);
    });

    it('should use type hint for determination', () => {
      const debitResult = determineDebitCredit('5000', 'DR');
      expect(debitResult.debit).toBe(5000);

      const creditResult = determineDebitCredit('5000', 'CR');
      expect(creditResult.credit).toBe(5000);
    });

    it('should treat negative numbers as debit', () => {
      const result = determineDebitCredit(-5000);
      expect(result.debit).toBe(5000);
      expect(result.credit).toBe(0);
    });
  });

  describe('escapeXml', () => {
    it('should escape special characters', () => {
      expect(escapeXml('a & b')).toBe('a &amp; b');
      expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
      expect(escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('should handle empty strings', () => {
      expect(escapeXml('')).toBe('');
    });
  });

  describe('cleanDescription', () => {
    it('should normalize whitespace', () => {
      expect(cleanDescription('hello   world')).toBe('hello world');
    });

    it('should trim the result', () => {
      expect(cleanDescription('  hello  ')).toBe('hello');
    });
  });
});
