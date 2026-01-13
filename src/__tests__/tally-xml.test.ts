import { describe, it, expect } from 'vitest';
import { generateTallyXml } from '../lib/tally-xml';
import type { Transaction } from '../lib/schema';

describe('Tally XML Generator', () => {
  const sampleTransactions: Transaction[] = [
    {
      id: 'tx1',
      date: '2024-01-15',
      description: 'NEFT CR FROM ABC COMPANY',
      reference: 'N1234567890',
      debit: 0,
      credit: 25000,
      currency: 'INR',
    },
    {
      id: 'tx2',
      date: '2024-01-16',
      description: 'VENDOR PAYMENT',
      reference: 'PAY001',
      debit: 10000,
      credit: 0,
      currency: 'INR',
    },
  ];

  it('should generate valid XML structure', () => {
    const xml = generateTallyXml(sampleTransactions);
    
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<ENVELOPE>');
    expect(xml).toContain('<HEADER>');
    expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>');
    expect(xml).toContain('<BODY>');
    expect(xml).toContain('<IMPORTDATA>');
    expect(xml).toContain('</ENVELOPE>');
  });

  it('should create Receipt voucher for credit transactions', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        date: '2024-01-15',
        description: 'NEFT CREDIT',
        debit: 0,
        credit: 50000,
        currency: 'INR',
      },
    ];

    const xml = generateTallyXml(transactions);
    
    expect(xml).toContain('VCHTYPE="Receipt"');
    expect(xml).toContain('<VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>');
  });

  it('should create Payment voucher for debit transactions', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        date: '2024-01-15',
        description: 'VENDOR PAYMENT',
        debit: 10000,
        credit: 0,
        currency: 'INR',
      },
    ];

    const xml = generateTallyXml(transactions);
    
    expect(xml).toContain('VCHTYPE="Payment"');
    expect(xml).toContain('<VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>');
  });

  it('should use custom bank name and company name', () => {
    const xml = generateTallyXml(sampleTransactions, {
      bankName: 'ICICI Bank',
      companyName: 'Test Company Pvt Ltd',
    });
    
    expect(xml).toContain('ICICI Bank');
    expect(xml).toContain('Test Company Pvt Ltd');
  });

  it('should format date as YYYYMMDD for Tally', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        date: '2024-06-15',
        description: 'Test',
        debit: 100,
        credit: 0,
        currency: 'INR',
      },
    ];

    const xml = generateTallyXml(transactions);
    
    expect(xml).toContain('<DATE>20240615</DATE>');
  });

  it('should include narration with description and reference', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        date: '2024-01-15',
        description: 'NEFT Payment',
        reference: 'REF123',
        debit: 100,
        credit: 0,
        currency: 'INR',
      },
    ];

    const xml = generateTallyXml(transactions);
    
    expect(xml).toContain('NEFT Payment | Ref: REF123');
  });

  it('should apply ledger rules based on keywords', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        date: '2024-01-15',
        description: 'SALARY CREDIT JAN 2024',
        debit: 0,
        credit: 50000,
        currency: 'INR',
      },
    ];

    const xml = generateTallyXml(transactions, {
      bankName: 'HDFC Bank',
      ledgerRules: [
        {
          keywords: ['salary'],
          ledgerName: 'Salary Payable',
          voucherType: 'Receipt',
        },
      ],
    });
    
    expect(xml).toContain('Salary Payable');
  });

  it('should escape XML special characters', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        date: '2024-01-15',
        description: 'Payment for "Services" & <Items>',
        debit: 100,
        credit: 0,
        currency: 'INR',
      },
    ];

    const xml = generateTallyXml(transactions);
    
    expect(xml).toContain('&quot;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
  });
});
