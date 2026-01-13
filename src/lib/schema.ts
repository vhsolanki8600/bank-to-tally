import { z } from 'zod';

// Transaction schema for parsed bank statement entries
export const TransactionSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  balance: z.number().optional(),
  currency: z.string().default('INR'),
  bankName: z.string().optional(),
  accountNumberLast4: z.string().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// Parse result from any parser
export const ParseResultSchema = z.object({
  transactions: z.array(TransactionSchema),
  warnings: z.array(z.string()).default([]),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  statementPeriod: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ParseResult = z.infer<typeof ParseResultSchema>;

// Export options for Tally XML
export const ExportOptionsSchema = z.object({
  bankName: z.string().default('Bank Account'),
  companyName: z.string().default('My Company'),
  suspenseLedger: z.string().default('Suspense - Bank Import'),
  ledgerRules: z.array(z.object({
    keywords: z.array(z.string()),
    ledgerName: z.string(),
    voucherType: z.enum(['Payment', 'Receipt', 'Contra']).optional(),
  })).default([]),
});

export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

// Ledger rule for automatic categorization
export const LedgerRuleSchema = z.object({
  keywords: z.array(z.string()).min(1),
  ledgerName: z.string().min(1),
  voucherType: z.enum(['Payment', 'Receipt', 'Contra']).optional(),
});

export type LedgerRule = z.infer<typeof LedgerRuleSchema>;

// Job status for tracking parsing progress
export const JobStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  fileName: z.string(),
  fileType: z.string(),
  result: ParseResultSchema.optional(),
  error: z.string().optional(),
  createdAt: z.string(),
});

export type JobStatus = z.infer<typeof JobStatusSchema>;

// Upload response
export const UploadResponseSchema = z.object({
  jobId: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  message: z.string(),
});

export type UploadResponse = z.infer<typeof UploadResponseSchema>;

// AI extraction prompt response
export const AIExtractionResponseSchema = z.object({
  transactions: z.array(z.object({
    date: z.string(),
    narration: z.string(),
    txn_no: z.string().optional(),
    debit: z.number().optional(),
    credit: z.number().optional(),
    balance: z.number().optional(),
  })),
  confidence: z.number().optional(),
});

export type AIExtractionResponse = z.infer<typeof AIExtractionResponseSchema>;
