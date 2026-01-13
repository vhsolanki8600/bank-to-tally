'use client';

import { useEffect, useState } from 'react';

export interface ChunkInfo {
  chunkNum: number;
  pages: string;
  transactionCount: number;
}

interface ProcessStatusProps {
  isProcessing: boolean;
  statusMessage: string;
  currentChunk: number;
  totalChunks: number;
  transactionsFound: number;
  chunkDetails: ChunkInfo[];
}

export function ProcessStatus({ 
  isProcessing, 
  statusMessage, 
  currentChunk, 
  totalChunks, 
  transactionsFound,
  chunkDetails
}: ProcessStatusProps) {
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    if (totalChunks > 0 && currentChunk > 0) {
      const percent = Math.min(95, Math.round((currentChunk / totalChunks) * 100));
      setProgressPercent(percent);
    } else if (!isProcessing) {
      setProgressPercent(100);
    }
  }, [currentChunk, totalChunks, isProcessing]);

  // Hide completely when not processing AND no chunk details to show
  if (!isProcessing && chunkDetails.length === 0) return null;

  return (
    <div className="process-status-container">
      <div className="status-header">
        <div className="status-title">
          {isProcessing ? (
            <span className="spinner">⚡</span>
          ) : (
            <span className="complete-icon">✅</span>
          )}
          <h4>{isProcessing ? 'AI Processing Output' : 'Processing Complete'}</h4>
        </div>
        <div className="status-meta">
          <span className="chunk-badge">
            {totalChunks > 0 ? `Chunk ${currentChunk}/${totalChunks}` : 'Initializing...'}
          </span>
          <span className="found-badge">
            Total Transactions: <strong>{transactionsFound}</strong>
          </span>
        </div>
      </div>

      {isProcessing && (
        <>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="status-message">{statusMessage}</p>
        </>
      )}

      {/* Per-Chunk Breakdown */}
      {chunkDetails.length > 0 && (
        <div className="chunk-breakdown">
          <h5>Chunk Breakdown (Debug)</h5>
          <table className="chunk-table">
            <thead>
              <tr>
                <th>Chunk</th>
                <th>Pages</th>
                <th>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {chunkDetails.map((chunk) => (
                <tr key={chunk.chunkNum} className={chunk.transactionCount === 0 ? 'zero-transactions' : ''}>
                  <td>{chunk.chunkNum}</td>
                  <td>{chunk.pages}</td>
                  <td>{chunk.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
