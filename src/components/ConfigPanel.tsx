'use client';

import { useState, useEffect } from 'react';

export interface ConfigSettings {
  apiProvider: 'gemini' | 'groq';
  apiKey: string;
  modelId: string;
  bankLedgerName: string;
  partyLedgerName: string;
  suspenseLedger: string;
  dateFormat: string;
  autoNumberVouchers: boolean;
}

interface ConfigPanelProps {
  onConfigChange: (config: ConfigSettings) => void;
  initialConfig?: Partial<ConfigSettings>;
}

const MODELS = {
  gemini: [
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    
  ],
  groq: [
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout (Vision)' },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick (Vision)' },
    // { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
    // { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision' },
    // { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  ],
};

const DATE_FORMATS = [
  { id: 'dd/mm/yyyy', name: 'DD/MM/YYYY (Indian)', example: '15/01/2024' },
  { id: 'yyyy-mm-dd', name: 'YYYY-MM-DD (ISO)', example: '2024-01-15' },
  { id: 'mm/dd/yyyy', name: 'MM/DD/YYYY (US)', example: '01/15/2024' },
  { id: 'dd-mm-yyyy', name: 'DD-MM-YYYY', example: '15-01-2024' },
  { id: 'dd mmm yyyy', name: 'DD MMM YYYY', example: '15 Jan 2024' },
];

export function ConfigPanel({ onConfigChange, initialConfig }: ConfigPanelProps) {
  const [config, setConfig] = useState<ConfigSettings>({
    apiProvider: initialConfig?.apiProvider || 'gemini',
    apiKey: initialConfig?.apiKey || '',
    modelId: initialConfig?.modelId || 'gemini-2.5-flash',
    bankLedgerName: initialConfig?.bankLedgerName || 'SBI',
    partyLedgerName: initialConfig?.partyLedgerName || '',
    suspenseLedger: initialConfig?.suspenseLedger || 'Suspense',
    dateFormat: initialConfig?.dateFormat || 'dd/mm/yyyy',
    autoNumberVouchers: initialConfig?.autoNumberVouchers ?? false,
  });

  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    onConfigChange(config);
  }, [config, onConfigChange]);

  const handleChange = (field: keyof ConfigSettings, value: string | boolean) => {
    setConfig(prev => {
      const updated = { ...prev, [field]: value };
      
      // Reset model when provider changes
      if (field === 'apiProvider') {
        updated.modelId = value === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.3-70b-versatile';
      }
      
      return updated;
    });
  };

  const availableModels = MODELS[config.apiProvider];

  return (
    <div className="config-panel">
      <div className="config-header">
        <span className="config-icon">⚙️</span>
        <h3>CONFIGURATION</h3>
      </div>

      <div className="config-grid">
        {/* API Provider Toggle */}
        <div className="config-field">
          <label>AI Provider</label>
          <div className="provider-toggle">
            <button
              type="button"
              className={`toggle-btn ${config.apiProvider === 'gemini' ? 'active' : ''}`}
              onClick={() => handleChange('apiProvider', 'gemini')}
            >
              Gemini
            </button>
            <button
              type="button"
              className={`toggle-btn ${config.apiProvider === 'groq' ? 'active' : ''}`}
              onClick={() => handleChange('apiProvider', 'groq')}
            >
              Groq
            </button>
          </div>
        </div>

        {/* API Key */}
        <div className="config-field">
          <label>{config.apiProvider === 'gemini' ? 'Gemini' : 'Groq'} API Key</label>
          <div className="input-with-toggle">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder="Enter your API key..."
            />
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? '👁️' : '🔒'}
            </button>
          </div>
          <span className="field-hint">
            {config.apiProvider === 'gemini' 
              ? 'Get from aistudio.google.com' 
              : 'Get from console.groq.com'}
          </span>
        </div>

        {/* Model ID */}
        <div className="config-field">
          <label>Model ID</label>
          <select
            value={config.modelId}
            onChange={(e) => handleChange('modelId', e.target.value)}
          >
            {availableModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Format */}
        <div className="config-field">
          <label>Date Display Format</label>
          <select
            value={config.dateFormat}
            onChange={(e) => handleChange('dateFormat', e.target.value)}
          >
            {DATE_FORMATS.map(fmt => (
              <option key={fmt.id} value={fmt.id}>
                {fmt.name} ({fmt.example})
              </option>
            ))}
          </select>
        </div>

        {/* Bank Ledger Name */}
        <div className="config-field">
          <label>My Bank Ledger Name</label>
          <input
            type="text"
            value={config.bankLedgerName}
            onChange={(e) => handleChange('bankLedgerName', e.target.value)}
            placeholder="e.g. SBI, HDFC Bank"
          />
        </div>

        {/* Suspense Ledger */}
        <div className="config-field">
          <label>Suspense Ledger Name</label>
          <input
            type="text"
            value={config.suspenseLedger}
            onChange={(e) => handleChange('suspenseLedger', e.target.value)}
            placeholder="e.g. Suspense, Cash"
          />
          <span className="field-hint">Default ledger for unknown parties</span>
        </div>

        {/* Default Party Ledger */}
        <div className="config-field">
          <label>Default Party Ledger Name</label>
          <input
            type="text"
            value={config.partyLedgerName}
            onChange={(e) => handleChange('partyLedgerName', e.target.value)}
            placeholder="Leave empty to use Suspense"
          />
        </div>

        {/* Auto-Number Vouchers */}
        <div className="config-field checkbox-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.autoNumberVouchers}
              onChange={(e) => handleChange('autoNumberVouchers', e.target.checked)}
            />
            <span>Auto-Number Vouchers (1, 2, 3...) for Tally Export</span>
          </label>
        </div>
      </div>
    </div>
  );
}
