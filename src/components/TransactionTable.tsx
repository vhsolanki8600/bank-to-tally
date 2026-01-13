'use client';

import { useState, useCallback } from 'react';
import type { Transaction } from '@/lib/schema';

interface TransactionTableProps {
  transactions: Transaction[];
  onUpdate: (transactions: Transaction[]) => void;
  dateFormat?: string;
}

/**
 * Format date string according to the specified format
 */
function formatDate(dateStr: string, format: string): string {
  if (!dateStr) return '-';
  
  // Parse the date (could be yyyy-mm-dd, dd/mm/yyyy, etc.)
  let day: string, month: string, year: string;
  
  if (dateStr.includes('-')) {
    // ISO format: yyyy-mm-dd
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      [year, month, day] = parts;
    } else {
      [day, month, year] = parts;
    }
  } else if (dateStr.includes('/')) {
    // dd/mm/yyyy or mm/dd/yyyy
    const parts = dateStr.split('/');
    if (parts[2]?.length === 4) {
      // Assume dd/mm/yyyy for Indian format
      [day, month, year] = parts;
    } else {
      [day, month, year] = parts;
    }
  } else {
    return dateStr; // Return as-is if format unknown
  }
  
  // Ensure leading zeros
  day = day?.padStart(2, '0') || '01';
  month = month?.padStart(2, '0') || '01';
  year = year || '2024';
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[parseInt(month, 10) - 1] || 'Jan';
  
  switch (format) {
    case 'dd/mm/yyyy':
      return `${day}/${month}/${year}`;
    case 'yyyy-mm-dd':
      return `${year}-${month}-${day}`;
    case 'mm/dd/yyyy':
      return `${month}/${day}/${year}`;
    case 'dd-mm-yyyy':
      return `${day}-${month}-${year}`;
    case 'dd mmm yyyy':
      return `${day} ${monthName} ${year}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

export function TransactionTable({ transactions, onUpdate, dateFormat = 'dd/mm/yyyy' }: TransactionTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Transaction>>({});

  const handleEdit = useCallback((tx: Transaction) => {
    setEditingId(tx.id);
    setEditValues({
      date: tx.date,
      description: tx.description,
      reference: tx.reference,
      debit: tx.debit,
      credit: tx.credit,
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!editingId) return;
    
    const updated = transactions.map(tx => 
      tx.id === editingId 
        ? { ...tx, ...editValues }
        : tx
    );
    
    onUpdate(updated);
    setEditingId(null);
    setEditValues({});
  }, [editingId, editValues, transactions, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setEditValues({});
  }, []);

  const handleDelete = useCallback((id: string) => {
    const updated = transactions.filter(tx => tx.id !== id);
    onUpdate(updated);
  }, [transactions, onUpdate]);

  const handleInputChange = useCallback((field: keyof Transaction, value: string | number) => {
    setEditValues(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <p>No transactions to display</p>
        <p className="hint">Upload a bank statement to get started</p>
      </div>
    );
  }

  // Calculate totals
  const totalDebit = transactions.reduce((sum, tx) => sum + (tx.debit || 0), 0);
  const totalCredit = transactions.reduce((sum, tx) => sum + (tx.credit || 0), 0);

  return (
    <div className="table-container">
      <div className="table-header">
        <h3>Transactions ({transactions.length})</h3>
        <div className="table-summary">
          <span className="debit-total">Total Debit: ₹{totalDebit.toLocaleString('en-IN')}</span>
          <span className="credit-total">Total Credit: ₹{totalCredit.toLocaleString('en-IN')}</span>
        </div>
      </div>
      
      <div className="table-scroll">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Reference</th>
              <th className="amount-col">Debit</th>
              <th className="amount-col">Credit</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className={editingId === tx.id ? 'editing' : ''}>
                {editingId === tx.id ? (
                  <>
                    <td>
                      <input
                        type="date"
                        value={editValues.date || ''}
                        onChange={(e) => handleInputChange('date', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editValues.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editValues.reference || ''}
                        onChange={(e) => handleInputChange('reference', e.target.value)}
                      />
                    </td>
                    <td className="amount-col">
                      <input
                        type="number"
                        value={editValues.debit || 0}
                        onChange={(e) => handleInputChange('debit', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="amount-col">
                      <input
                        type="number"
                        value={editValues.credit || 0}
                        onChange={(e) => handleInputChange('credit', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="actions-col">
                      <button className="btn-save" onClick={handleSave}>✓</button>
                      <button className="btn-cancel" onClick={handleCancel}>✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{formatDate(tx.date, dateFormat)}</td>
                    <td className="description-cell" title={tx.description}>{tx.description}</td>
                    <td>{tx.reference || '-'}</td>
                    <td className="amount-col debit">{tx.debit ? `₹${tx.debit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="amount-col credit">{tx.credit ? `₹${tx.credit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="actions-col">
                      <button className="btn-edit" onClick={() => handleEdit(tx)}>✎</button>
                      <button className="btn-delete" onClick={() => handleDelete(tx.id)}>🗑</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
