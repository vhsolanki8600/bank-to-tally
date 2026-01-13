import { v4 as uuidv4 } from 'uuid';
import type { Transaction } from './schema';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Parse date from common Indian bank formats to YYYY-MM-DD
 * Supports: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD
 */
export function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  
  const cleaned = dateStr.trim();
  
  // Already in correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const match = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // MM/DD/YYYY format (less common in India but handle it)
  const usMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (usMatch) {
    const [, day, month, year] = usMatch;
    const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try parsing as a date object
  try {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Fall through
  }
  
  return cleaned;
}

/**
 * Parse amount string to number
 * Handles: commas, INR formatting, negative signs, Dr/Cr suffixes
 */
export function parseAmount(amountStr: string | number): number {
  if (typeof amountStr === 'number') {
    return Math.abs(amountStr);
  }
  
  if (!amountStr) return 0;
  
  let cleaned = amountStr.toString().trim();
  
  // Remove currency symbols and whitespace
  cleaned = cleaned.replace(/[₹$€£\s]/g, '');
  
  // Remove commas (Indian: 1,00,000 or Western: 100,000)
  cleaned = cleaned.replace(/,/g, '');
  
  // Check for Dr/Cr suffix
  const isDr = /dr\.?$/i.test(cleaned);
  const isCr = /cr\.?$/i.test(cleaned);
  cleaned = cleaned.replace(/(dr\.?|cr\.?)$/i, '');
  
  // Parse the number
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) return 0;
  
  return Math.abs(num);
}

/**
 * Determine if amount is debit or credit based on string indicators
 */
export function determineDebitCredit(
  amountStr: string | number,
  typeHint?: string
): { debit: number; credit: number } {
  const amount = parseAmount(amountStr);
  const amountString = amountStr.toString().toLowerCase();
  const hint = (typeHint || '').toLowerCase();
  
  // Check for explicit type hints
  if (hint.includes('dr') || hint.includes('debit') || hint.includes('withdrawal')) {
    return { debit: amount, credit: 0 };
  }
  if (hint.includes('cr') || hint.includes('credit') || hint.includes('deposit')) {
    return { debit: 0, credit: amount };
  }
  
  // Check amount string for Dr/Cr
  if (amountString.includes('dr') || amountString.startsWith('-')) {
    return { debit: amount, credit: 0 };
  }
  if (amountString.includes('cr')) {
    return { debit: 0, credit: amount };
  }
  
  // Negative = debit (money out), Positive = credit (money in)
  if (typeof amountStr === 'number' && amountStr < 0) {
    return { debit: amount, credit: 0 };
  }
  
  // Default to credit if no indicators
  return { debit: 0, credit: amount };
}

/**
 * Generate duplicate key for transaction
 */
export function getDuplicateKey(tx: Transaction): string {
  return `${tx.date}|${tx.description.toLowerCase().trim()}|${tx.debit}|${tx.credit}|${tx.reference || ''}`;
}

/**
 * Find and mark duplicate transactions
 */
export function findDuplicates(transactions: Transaction[]): Set<string> {
  const seen = new Map<string, string[]>();
  const duplicateIds = new Set<string>();
  
  for (const tx of transactions) {
    const key = getDuplicateKey(tx);
    const existing = seen.get(key) || [];
    if (existing.length > 0) {
      duplicateIds.add(tx.id);
      existing.forEach(id => duplicateIds.add(id));
    }
    existing.push(tx.id);
    seen.set(key, existing);
  }
  
  return duplicateIds;
}

/**
 * Format date for Tally XML (YYYYMMDD)
 */
export function formatTallyDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Escape XML special characters
 */
export function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Clean and normalize description text
 */
export function cleanDescription(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-\/\.\,\@\#\(\)]/g, '')
    .trim();
}

/**
 * Detect file type from extension
 */
export function getFileType(fileName: string): 'csv' | 'excel' | 'pdf' | 'image' | 'unknown' {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  
  if (ext === 'csv') return 'csv';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  
  return 'unknown';
}

/**
 * Validate file size (max 10MB)
 */
export function validateFileSize(sizeInBytes: number, maxMB: number = 10): boolean {
  return sizeInBytes <= maxMB * 1024 * 1024;
}

/**
 * Allowed MIME types
 */
export const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
