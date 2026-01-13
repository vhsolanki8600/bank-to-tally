import type { Transaction, ParseResult, ExportOptions, LedgerRule } from './schema';
import { formatTallyDate, escapeXml } from './utils';

/**
 * Determine voucher type based on transaction
 */
function getVoucherType(tx: Transaction): 'Payment' | 'Receipt' | 'Contra' {
  const desc = tx.description.toLowerCase();
  
  // Contra transactions (bank to bank transfers)
  if (desc.includes('transfer') && (desc.includes('self') || desc.includes('own'))) {
    return 'Contra';
  }
  
  // Payment (money going out)
  if (tx.debit > 0) {
    return 'Payment';
  }
  
  // Receipt (money coming in)
  return 'Receipt';
}

/**
 * Find matching ledger rule based on transaction description
 */
function findMatchingRule(tx: Transaction, rules: LedgerRule[]): LedgerRule | null {
  const desc = tx.description.toLowerCase();
  
  for (const rule of rules) {
    const matches = rule.keywords.some(keyword => 
      desc.includes(keyword.toLowerCase())
    );
    if (matches) {
      return rule;
    }
  }
  
  return null;
}

/**
 * Generate a single voucher XML
 */
function generateVoucherXml(
  tx: Transaction,
  options: ExportOptions,
  voucherNumber: number
): string {
  const { bankName, suspenseLedger, ledgerRules } = options;
  
  const voucherType = getVoucherType(tx);
  const matchedRule = findMatchingRule(tx, ledgerRules);
  
  const counterpartyLedger = matchedRule?.ledgerName || suspenseLedger;
  const finalVoucherType = matchedRule?.voucherType || voucherType;
  
  const amount = tx.debit > 0 ? tx.debit : tx.credit;
  const narration = `${tx.description}${tx.reference ? ` | Ref: ${tx.reference}` : ''}`;
  
  // Determine which ledger is debited and which is credited
  let debitLedger: string;
  let creditLedger: string;
  
  if (tx.debit > 0) {
    // Money going out: Debit the counterparty, Credit the bank
    debitLedger = counterpartyLedger;
    creditLedger = bankName;
  } else {
    // Money coming in: Debit the bank, Credit the counterparty
    debitLedger = bankName;
    creditLedger = counterpartyLedger;
  }
  
  return `
    <VOUCHER REMOTEID="${escapeXml(tx.id)}" VCHTYPE="${escapeXml(finalVoucherType)}" ACTION="Create">
      <DATE>${formatTallyDate(tx.date)}</DATE>
      <VOUCHERTYPENAME>${escapeXml(finalVoucherType)}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER>
      <NARRATION>${escapeXml(narration)}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(debitLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(creditLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${amount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
}

/**
 * Generate complete Tally import XML from transactions
 */
export function generateTallyXml(
  transactions: Transaction[],
  options: Partial<ExportOptions> = {}
): string {
  const fullOptions: ExportOptions = {
    bankName: options.bankName || 'Bank Account',
    companyName: options.companyName || 'My Company',
    suspenseLedger: options.suspenseLedger || 'Suspense - Bank Import',
    ledgerRules: options.ledgerRules || [],
  };
  
  const vouchers = transactions.map((tx, index) => 
    generateVoucherXml(tx, fullOptions, index + 1)
  ).join('');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(fullOptions.companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
${vouchers}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Convert transactions to CSV format
 */
export function transactionsToCSV(transactions: Transaction[]): string {
  const headers = ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'Currency'];
  const rows = transactions.map(tx => [
    tx.date,
    `"${tx.description.replace(/"/g, '""')}"`,
    tx.reference || '',
    tx.debit || '',
    tx.credit || '',
    tx.balance || '',
    tx.currency || 'INR',
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Convert transactions to JSON format
 */
export function transactionsToJSON(transactions: Transaction[]): string {
  return JSON.stringify(transactions, null, 2);
}
