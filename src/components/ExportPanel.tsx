'use client';

import { useCallback } from 'react';
import type { Transaction, ExportOptions } from '@/lib/schema';
import { generateTallyXml, transactionsToCSV, transactionsToJSON } from '@/lib/tally-xml';
import * as XLSX from 'xlsx';

interface ExportPanelProps {
  transactions: Transaction[];
  bankLedgerName?: string;
  partyLedgerName?: string;
  suspenseLedger?: string;
  autoNumberVouchers?: boolean;
}

export function ExportPanel({ 
  transactions, 
  bankLedgerName = 'SBI',
  partyLedgerName = '',
  suspenseLedger = 'Suspense',
  autoNumberVouchers = false
}: ExportPanelProps) {

  const downloadFile = useCallback((content: string | Blob, filename: string, type: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleExportTallyXml = useCallback(() => {
    const options: Partial<ExportOptions> = {
      bankName: bankLedgerName,
      companyName: 'My Company',
      suspenseLedger: suspenseLedger || 'Suspense',
      ledgerRules: [],
    };
    
    const xml = generateTallyXml(transactions, options);
    downloadFile(xml, 'tally-import.xml', 'application/xml');
  }, [transactions, bankLedgerName, suspenseLedger, downloadFile]);

  const handleExportJson = useCallback(() => {
    const json = transactionsToJSON(transactions);
    downloadFile(json, 'transactions.json', 'application/json');
  }, [transactions, downloadFile]);

  const handleExportCsv = useCallback(() => {
    const csv = transactionsToCSV(transactions);
    downloadFile(csv, 'transactions.csv', 'text/csv');
  }, [transactions, downloadFile]);

  const handleExportExcel = useCallback(() => {
    const data = transactions.map(tx => ({
      Date: tx.date,
      Description: tx.description,
      Reference: tx.reference || '',
      Debit: tx.debit || '',
      Credit: tx.credit || '',
      Balance: tx.balance || '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadFile(blob, 'transactions.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }, [transactions, downloadFile]);

  const isDisabled = transactions.length === 0;

  return (
    <div className="export-panel">
      <div className="export-header">
        <h3>Export</h3>
        {bankLedgerName && <span className="export-bank-info">Bank: {bankLedgerName}</span>}
      </div>
      
      <div className="export-buttons">
        <button 
          className="btn-export btn-primary"
          onClick={handleExportTallyXml}
          disabled={isDisabled}
        >
          <span className="btn-icon">📊</span>
          Export Tally XML
        </button>
        
        <div className="export-secondary">
          <button 
            className="btn-export"
            onClick={handleExportJson}
            disabled={isDisabled}
          >
            JSON
          </button>
          <button 
            className="btn-export"
            onClick={handleExportCsv}
            disabled={isDisabled}
          >
            CSV
          </button>
          <button 
            className="btn-export"
            onClick={handleExportExcel}
            disabled={isDisabled}
          >
            Excel
          </button>
        </div>
      </div>
      
      {isDisabled && (
        <p className="export-hint">Upload and parse a file first to enable exports</p>
      )}
    </div>
  );
}
