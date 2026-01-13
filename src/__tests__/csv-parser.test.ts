import { describe, it, expect } from 'vitest';
import { parseCSV } from '../lib/parsers/csv-parser';

describe('CSV Parser', () => {
  it('should parse a simple CSV with standard headers', () => {
    const csv = `Date,Description,Reference,Debit,Credit,Balance
01/01/2024,ATM Withdrawal,,5000,,45000.00
02/01/2024,NEFT CR FROM ABC COMPANY,N1234567890,,25000,75000`;

    const result = parseCSV(csv);
    
    // Should have 2 transactions (rows with amounts)
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].date).toBe('2024-01-01');
    expect(result.transactions[0].description).toBe('ATM Withdrawal');
    expect(result.transactions[0].debit).toBe(5000);
    expect(result.transactions[1].credit).toBe(25000);
    expect(result.transactions[1].reference).toBe('N1234567890');
  });

  it('should handle Indian date format DD-MM-YYYY', () => {
    const csv = `Txn Date,Particulars,Withdrawal,Deposit
15-06-2024,ATM WDL,5000,
16-06-2024,NEFT CREDIT,,10000`;

    const result = parseCSV(csv);
    
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].date).toBe('2024-06-15');
    expect(result.transactions[0].debit).toBe(5000);
    expect(result.transactions[1].credit).toBe(10000);
  });

  it('should handle amounts with commas', () => {
    const csv = `Date,Description,Debit,Credit
01/01/2024,Large Payment,"1,00,000",
02/01/2024,Deposit,,"50,000.50"`;

    const result = parseCSV(csv);
    
    expect(result.transactions[0].debit).toBe(100000);
    expect(result.transactions[1].credit).toBe(50000.5);
  });

  it('should skip total rows and empty rows', () => {
    const csv = `Date,Description,Debit,Credit
01/01/2024,Payment,1000,
Total,,,1000
,,,`;

    const result = parseCSV(csv);
    
    expect(result.transactions).toHaveLength(1);
  });

  it('should return warnings for missing columns', () => {
    const csv = `Col1,Col2,Col3
a,b,c`;

    const result = parseCSV(csv);
    
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('date'))).toBe(true);
  });
});
