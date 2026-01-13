import * as XLSX from 'xlsx';
import { generateId, parseDate, parseAmount, determineDebitCredit, cleanDescription } from '../utils';
import type { Transaction, ParseResult } from '../schema';

/**
 * Column name mappings (same as CSV parser)
 */
const COLUMN_MAPPINGS: Record<string, string[]> = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'txn_date', 'valuedate'],
  description: ['description', 'particulars', 'narration', 'details', 'remarks', 'transaction details', 'txn particulars'],
  reference: ['reference', 'ref', 'ref no', 'chq no', 'cheque no', 'utr', 'txn no', 'transaction id', 'ref_no', 'chq_no'],
  debit: ['debit', 'withdrawal', 'dr', 'debit amount', 'withdrawals', 'debit(dr)', 'dr_amount'],
  credit: ['credit', 'deposit', 'cr', 'credit amount', 'deposits', 'credit(cr)', 'cr_amount'],
  amount: ['amount', 'transaction amount', 'txn amount'],
  type: ['type', 'dr/cr', 'drcr', 'transaction type', 'txn type', 'cr/dr'],
  balance: ['balance', 'closing balance', 'running balance', 'available balance'],
};

/**
 * Find matching column key
 */
function findColumnKey(headers: string[], field: string): string | null {
  const aliases = COLUMN_MAPPINGS[field] || [];
  
  for (const header of headers) {
    const lowerHeader = header.toLowerCase().trim();
    for (const alias of aliases) {
      if (lowerHeader === alias || lowerHeader.includes(alias) || alias.includes(lowerHeader)) {
        return header;
      }
    }
  }
  
  return null;
}

/**
 * Parse Excel file (ArrayBuffer or Buffer) into transactions
 */
export function parseExcel(data: ArrayBuffer | Buffer): ParseResult {
  const warnings: string[] = [];
  const transactions: Transaction[] = [];
  
  // Read workbook
  const workbook = XLSX.read(data, { type: 'buffer' });
  
  if (workbook.SheetNames.length === 0) {
    return { transactions: [], warnings: ['No sheets found in Excel file'] };
  }
  
  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header detection
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: '',
  });
  
  if (rows.length === 0) {
    return { transactions: [], warnings: ['No data rows found in Excel file'] };
  }
  
  // Get headers from first row's keys
  const headers = Object.keys(rows[0]);
  
  // Find column mappings
  const dateKey = findColumnKey(headers, 'date');
  const descKey = findColumnKey(headers, 'description');
  const refKey = findColumnKey(headers, 'reference');
  const debitKey = findColumnKey(headers, 'debit');
  const creditKey = findColumnKey(headers, 'credit');
  const amountKey = findColumnKey(headers, 'amount');
  const typeKey = findColumnKey(headers, 'type');
  const balanceKey = findColumnKey(headers, 'balance');
  
  if (!dateKey) {
    warnings.push('Could not find date column');
  }
  if (!descKey) {
    warnings.push('Could not find description column');
  }
  
  // Parse rows
  for (const row of rows) {
    // Skip rows without valid date
    const dateValue = dateKey ? String(row[dateKey] || '') : '';
    if (!dateValue || dateValue.toLowerCase().includes('total')) {
      continue;
    }
    
    const date = parseDate(dateValue);
    if (!date || !/\d{4}-\d{2}-\d{2}/.test(date)) {
      continue;
    }
    
    const description = descKey ? cleanDescription(String(row[descKey] || '')) : '';
    const reference = refKey ? String(row[refKey] || '').trim() : '';
    const balance = balanceKey ? parseAmount(String(row[balanceKey] || '')) : undefined;
    
    // Determine debit and credit
    let debit = 0;
    let credit = 0;
    
    if (debitKey && creditKey) {
      debit = parseAmount(String(row[debitKey] || ''));
      credit = parseAmount(String(row[creditKey] || ''));
    } else if (amountKey) {
      const amount = String(row[amountKey] || '');
      const type = typeKey ? String(row[typeKey] || '') : '';
      const result = determineDebitCredit(amount, type);
      debit = result.debit;
      credit = result.credit;
    }
    
    if (debit === 0 && credit === 0) {
      continue;
    }
    
    transactions.push({
      id: generateId(),
      date,
      description,
      reference,
      debit,
      credit,
      balance,
      currency: 'INR',
    });
  }
  
  if (transactions.length === 0) {
    warnings.push('No valid transactions found in Excel file');
  }
  
  return { transactions, warnings };
}

/**
 * Parse Excel from base64 string
 */
export function parseExcelBase64(base64Data: string): ParseResult {
  const buffer = Buffer.from(base64Data, 'base64');
  return parseExcel(buffer);
}
