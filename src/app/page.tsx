'use client';

import { useState, useCallback } from 'react';
import { FileUpload, TransactionTable, ExportPanel, ConfigPanel, ProcessStatus } from '@/components';
import type { ConfigSettings } from '@/components';
import type { ChunkInfo } from '@/components/ProcessStatus';
import { parseCSV, parseExcel } from '@/lib/parsers';
import { getFileType } from '@/lib/utils';
import type { Transaction, ParseResult } from '@/lib/schema';

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Streaming state
  const [statusMessage, setStatusMessage] = useState('');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [chunkDetails, setChunkDetails] = useState<ChunkInfo[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const [config, setConfig] = useState<ConfigSettings>({
    apiProvider: 'gemini',
    apiKey: '',
    modelId: 'gemini-2.5-flash',
    bankLedgerName: 'SBI',
    partyLedgerName: '',
    suspenseLedger: 'Suspense',
    dateFormat: 'dd/mm/yyyy',
    autoNumberVouchers: false,
  });

  const handleConfigChange = useCallback((newConfig: ConfigSettings) => {
    setConfig(newConfig);
    setError(null);
  }, []);

  const handleProcess = useCallback(async (file: File) => {
    if (!config.apiKey) {
      setError(`Please enter your ${config.apiProvider === 'gemini' ? 'Gemini' : 'Groq'} API key`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarnings([]);
    setTransactions([]);
    setStatusMessage('Initializing...');
    setCurrentChunk(0);
    setTotalChunks(0);
    setChunkDetails([]);
    setShowDebug(true);
    
    try {
      const fileType = getFileType(file.name);
      
      if (fileType === 'csv') {
        const text = await file.text();
        const result = parseCSV(text);
        setTransactions(result.transactions);
        setWarnings(result.warnings || []);
        setIsLoading(false);
        setShowDebug(false);
        
      } else if (fileType === 'excel') {
        const buffer = await file.arrayBuffer();
        const result = parseExcel(buffer);
        setTransactions(result.transactions);
        setWarnings(result.warnings || []);
        setIsLoading(false);
        setShowDebug(false);
        
      } else if (fileType === 'pdf') {
        // PDF STREAMING LOGIC
        const formData = new FormData();
        formData.append('file', file);
        formData.append('apiProvider', config.apiProvider);
        formData.append('apiKey', config.apiKey);
        formData.append('modelId', config.modelId);

        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok || !response.body) {
           const errData = await response.json().catch(() => ({}));
           throw new Error(errData.error || 'Failed to start PDF processing');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let pagesPerChunk = 2; // Default

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep partial line

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              
              if (event.type === 'progress') {
                setStatusMessage(event.message);
                setCurrentChunk(event.chunk);
                setTotalChunks(event.totalChunks);
              } 
              else if (event.type === 'transactions') {
                const txCount = event.data.length;
                const chunkNum = event.chunkNum || currentChunk;
                const pages = event.pages || `${(chunkNum - 1) * pagesPerChunk + 1}-${chunkNum * pagesPerChunk}`;
                
                // Add chunk detail (if not already added)
                setChunkDetails(prev => {
                  if (prev.some(c => c.chunkNum === chunkNum)) return prev;
                  return [...prev, { chunkNum, pages, transactionCount: txCount }];
                });
                
                setTransactions(prev => [...prev, ...event.data]);
              } 
              else if (event.type === 'complete') {
                setWarnings(event.warnings || []);
              } 
              else if (event.type === 'error') {
                throw new Error(event.message);
              }
            } catch (e) {
              console.error('Error parsing stream event:', e);
            }
          }
        }
        setIsLoading(false);

      } else if (fileType === 'image') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('apiProvider', config.apiProvider);
        formData.append('apiKey', config.apiKey);
        formData.append('modelId', config.modelId);
        
        setStatusMessage('Processing image with AI...');
        
        const response = await fetch('/api/parse-image', { method: 'POST', body: formData });
        if (!response.ok) {
           const data = await response.json();
           throw new Error(data.error || 'Image processing failed');
        }
        const result = await response.json();
        setTransactions(result.transactions);
        setWarnings(result.warnings || []);
        setIsLoading(false);
        setShowDebug(false);
        
      } else {
        throw new Error(`Unsupported file type: ${file.name}`);
      }
      
    } catch (err) {
      console.error('File processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setIsLoading(false);
    }
  }, [config, currentChunk]);

  const handleTransactionsUpdate = useCallback((updated: Transaction[]) => {
    setTransactions(updated);
  }, []);

  const isConfigValid = !!config.apiKey;

  return (
    <main className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>PDF IMAGE EXCEL BANK TO TALLY IMPORT WITH AI</h1>
        </div>
      </header>

      <div className="main-content">
        {/* Configuration Panel */}
        <section className="config-section">
          <ConfigPanel 
            onConfigChange={handleConfigChange}
            initialConfig={config}
          />
        </section>

        {/* File Upload Section */}
        <section className="upload-section">
          <FileUpload 
            onProcess={handleProcess} 
            isLoading={isLoading}
            disabled={!isConfigValid}
          />
        </section>

        {/* Process Status (Streaming UI) - Only show during processing or if showDebug is true */}
        {(isLoading || showDebug) && (
           <ProcessStatus 
             isProcessing={isLoading}
             statusMessage={statusMessage}
             currentChunk={currentChunk}
             totalChunks={totalChunks}
             transactionsFound={transactions.length}
             chunkDetails={chunkDetails}
           />
        )}

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Warnings Banner */}
        {warnings.length > 0 && !isLoading && (
          <div className="warning-banner">
            <span className="warning-icon">ℹ️</span>
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Transactions Table */}
        <section className="transactions-section">
          <TransactionTable 
            transactions={transactions}
            onUpdate={handleTransactionsUpdate}
            dateFormat={config.dateFormat}
          />
        </section>

        {/* Export Panel */}
        <section className="export-section">
          <ExportPanel 
            transactions={transactions}
            bankLedgerName={config.bankLedgerName}
            partyLedgerName={config.partyLedgerName}
            suspenseLedger={config.suspenseLedger}
            autoNumberVouchers={config.autoNumberVouchers}
          />
        </section>
      </div>

      <footer className="app-footer">
        <p>Bank-to-Tally Import (AI) • Open Source • Made with ❤️</p>
      </footer>
    </main>
  );
}
