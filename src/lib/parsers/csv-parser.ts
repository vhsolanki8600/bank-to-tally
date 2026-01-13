import Papa from 'papaparse';
import { generateId, parseDate, parseAmount, determineDebitCredit, cleanDescription } from '../utils';
import type { Transaction, ParseResult } from '../schema';

/**
 * Common column name mappings for Indian bank statements
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
 * Find matching column index by checking against known aliases
 */
function findColumnIndex(headers: string[], field: string): number {
  const aliases = COLUMN_MAPPINGS[field] || [];
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  for (const alias of aliases) {
    const index = lowerHeaders.indexOf(alias);
    if (index !== -1) return index;
  }
  
  // Partial match
  for (let i = 0; i < lowerHeaders.length; i++) {
    for (const alias of aliases) {
      if (lowerHeaders[i].includes(alias) || alias.includes(lowerHeaders[i])) {
        return i;
      }
    }
  }
  
  return -1;
}

/**
 * Parse CSV file content into transactions
 */
export function parseCSV(content: string): ParseResult {
  const warnings: string[] = [];
  const transactions: Transaction[] = [];
  
  // Parse CSV
  const result = Papa.parse(content, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  
  if (result.errors.length > 0) {
    warnings.push(`CSV parsing had ${result.errors.length} errors`);
  }
  
  const rows = result.data as string[][];
  if (rows.length < 2) {
    return { transactions: [], warnings: ['No data rows found in CSV'] };
  }
  
  // Find header row (first row with recognizable headers)
  let headerRowIndex = 0;
  let headers: string[] = [];
  
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    const potentialHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
    
    // Check if this row looks like headers
    if (potentialHeaders.some(h => 
      h.includes('date') || h.includes('description') || h.includes('narration') || 
      h.includes('debit') || h.includes('credit') || h.includes('amount')
    )) {
      headerRowIndex = i;
      headers = row.map(cell => String(cell || '').trim());
      break;
    }
  }
  
  if (headers.length === 0) {
    // No headers found, use first row
    headers = rows[0].map(cell => String(cell || '').trim());
    warnings.push('Could not detect headers, using first row');
  }
  
  // Find column indices
  const dateIdx = findColumnIndex(headers, 'date');
  const descIdx = findColumnIndex(headers, 'description');
  const refIdx = findColumnIndex(headers, 'reference');
  const debitIdx = findColumnIndex(headers, 'debit');
  const creditIdx = findColumnIndex(headers, 'credit');
  const amountIdx = findColumnIndex(headers, 'amount');
  const typeIdx = findColumnIndex(headers, 'type');
  const balanceIdx = findColumnIndex(headers, 'balance');
  
  if (dateIdx === -1) {
    warnings.push('Could not find date column');
  }
  if (descIdx === -1) {
    warnings.push('Could not find description column');
  }
  
  // Parse data rows
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    // Skip if date column is empty or looks like a header/footer
    const dateValue = row[dateIdx] || '';
    if (!dateValue || dateValue.toLowerCase().includes('total') || dateValue.toLowerCase().includes('balance')) {
      continue;
    }
    
    const date = parseDate(dateValue);
    if (!date || !/\d{4}-\d{2}-\d{2}/.test(date)) {
      continue; // Skip rows without valid dates
    }
    
    const description = descIdx !== -1 ? cleanDescription(row[descIdx] || '') : '';
    const reference = refIdx !== -1 ? String(row[refIdx] || '').trim() : '';
    const balance = balanceIdx !== -1 ? parseAmount(row[balanceIdx] || '') : undefined;
    
    // Determine debit and credit
    let debit = 0;
    let credit = 0;
    
    if (debitIdx !== -1 && creditIdx !== -1) {
      // Separate debit/credit columns
      debit = parseAmount(row[debitIdx] || '');
      credit = parseAmount(row[creditIdx] || '');
    } else if (amountIdx !== -1) {
      // Single amount column
      const amount = row[amountIdx] || '';
      const type = typeIdx !== -1 ? row[typeIdx] : '';
      const result = determineDebitCredit(amount, type as string);
      debit = result.debit;
      credit = result.credit;
    }
    
    // Skip rows with no amounts
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
    warnings.push('No valid transactions found in CSV');
  }
  
  return { transactions, warnings };
}
