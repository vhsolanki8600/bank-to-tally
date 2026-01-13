'use client';

import { useState, useCallback, useRef } from 'react';

interface FileInfo {
  file: File;
  name: string;
  size: string;
}

interface FileUploadProps {
  onProcess: (file: File) => void;
  isLoading?: boolean;
  acceptedTypes?: string;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function FileUpload({ 
  onProcess, 
  isLoading = false,
  acceptedTypes = '.csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png',
  disabled = false
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile({
        file,
        name: file.name,
        size: formatFileSize(file.size)
      });
    }
  }, [disabled]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile({
        file,
        name: file.name,
        size: formatFileSize(file.size)
      });
      e.target.value = '';
    }
  }, [disabled]);

  const handleChooseFile = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleProcess = () => {
    if (selectedFile && !isLoading && !disabled) {
      onProcess(selectedFile.file);
    }
  };

  return (
    <div className="file-upload-container">
      <div
        className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          onChange={handleFileInput}
          style={{ display: 'none' }}
          disabled={disabled || isLoading}
        />
        
        <div className="dropzone-content">
          <button 
            type="button" 
            className="choose-file-btn"
            onClick={handleChooseFile}
            disabled={disabled || isLoading}
          >
            Choose File
          </button>
          <span className="file-types">
            {selectedFile ? selectedFile.name : 'PDF, Excel, CSV, or Image'}
          </span>
        </div>

        {selectedFile && (
          <div className="selected-file">
            <div className="file-icon">📄</div>
            <div className="file-details">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">{selectedFile.size}</span>
            </div>
            <button 
              type="button"
              className="remove-file-btn"
              onClick={handleRemoveFile}
              disabled={isLoading}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="process-btn"
        onClick={handleProcess}
        disabled={!selectedFile || isLoading || disabled}
      >
        {isLoading ? (
          <>
            <span className="btn-spinner"></span>
            Processing...
          </>
        ) : (
          'Process Document'
        )}
      </button>
    </div>
  );
}
