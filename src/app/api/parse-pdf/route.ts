import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { PDFDocument } from 'pdf-lib';
import { generateId, parseDate, parseAmount } from '@/lib/utils';
import type { Transaction } from '@/lib/schema';
import { BANK_STATEMENT_EXTRACTION_PROMPT } from '@/lib/ai/prompts';

// Config
const GEMINI_PAGES_PER_CHUNK = 2; 
const GROQ_PAGES_PER_CHUNK = 2;

// Event types for streaming
type StreamEvent = 
  | { type: 'progress'; message: string; chunk: number; totalChunks: number }
  | { type: 'transactions'; data: Transaction[] }
  | { type: 'complete'; warnings: string[]; bankName?: string }
  | { type: 'error'; message: string };

/**
 * Helper to encode event as NDJSON
 */
function encodeEvent(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + '\n');
}

/**
 * Split PDF into chunks of pages with OVERLAP
 */
async function splitPdfIntoChunks(buffer: Buffer, pagesPerChunk: number): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(buffer);
  const totalPages = pdfDoc.getPageCount();
  const chunks: Buffer[] = [];
  
  // No overlap to prevent double counting
  const step = pagesPerChunk;

  for (let startPage = 0; startPage < totalPages; startPage += step) {
    let endPage = startPage + pagesPerChunk;
    if (endPage > totalPages) {
      endPage = totalPages;
      if (startPage >= totalPages) break;
    }
    
    const newPdf = await PDFDocument.create();
    const pageIndices = [];
    for (let i = startPage; i < endPage; i++) {
      pageIndices.push(i);
    }
    
    const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach(page => newPdf.addPage(page));
    
    const chunkBuffer = Buffer.from(await newPdf.save());
    chunks.push(chunkBuffer);
    
    if (endPage === totalPages) break;
  }
  
  return chunks;
}

/**
 * Process chunk with Gemini
 */
async function processChunkWithGemini(
  base64Data: string, 
  apiKey: string, 
  modelId: string,
  chunkNum: number,
  totalChunks: number
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  const prompt = `${BANK_STATEMENT_EXTRACTION_PROMPT}

This is chunk ${chunkNum} of ${totalChunks} from a bank statement PDF.
Extract ALL transactions from these pages. 
CRITICAL RULES:
1. Extract EVERY SINGLE transaction row. Do not skip any.
2. Do not summarize. If there are 50 transactions, output 50 items.
3. Return ONLY valid JSON with a "transactions" array.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType: 'application/pdf',
      },
    },
  ]);

  return result.response.text();
}

/**
 * Extract text from PDF buffer
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  } catch (error) {
    console.error('PDF text extraction error:', error);
    return '';
  }
}

/**
 * Process text with Groq
 */
async function processWithGroq(textContent: string, apiKey: string, modelId: string): Promise<string> {
  const groq = new Groq({ apiKey });
  
  const prompt = `${BANK_STATEMENT_EXTRACTION_PROMPT}

DATA TO EXTRACT:
${textContent}

CRITICAL RULES:
1. Extract EVERY SINGLE transaction row. Do not skip any.
2. Return ONLY valid JSON with a "transactions" array.`;

  const completion = await groq.chat.completions.create({
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 8000,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Parse AI response
 */
function parseAIResponse(responseText: string): { transactions: unknown[]; bankName?: string } {
  if (!responseText || responseText.trim().length === 0) return { transactions: [] };
  
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  // Robust JSON extraction (brace counting)
  let braceCount = 0, startIdx = -1, endIdx = -1;
  for (let i = 0; i < jsonStr.length; i++) {
    if (jsonStr[i] === '{') {
      if (startIdx === -1) startIdx = i;
      braceCount++;
    } else if (jsonStr[i] === '}') {
      braceCount--;
      if (braceCount === 0 && startIdx !== -1) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (startIdx !== -1 && endIdx !== -1) jsonStr = jsonStr.substring(startIdx, endIdx);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Fallbacks
    const arrayMatch = responseText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return { transactions: JSON.parse(arrayMatch[0]) }; } catch {}
    }
    return { transactions: [] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const apiProvider = formData.get('apiProvider') as string || 'gemini';
    const apiKey = formData.get('apiKey') as string || '';
    const modelId = formData.get('modelId') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const effectiveApiKey = apiKey || (apiProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY);
    const effectiveModelId = modelId || (apiProvider === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.3-70b-versatile');

    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: `No ${apiProvider === 'gemini' ? 'Gemini' : 'Groq'} API key provided.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a Streaming Response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const warnings: string[] = [];
          let bankName: string | undefined;

          // Split PDF
          controller.enqueue(encodeEvent({ 
            type: 'progress', 
            message: 'Analyzing PDF structure and splitting pages...', 
            chunk: 0, 
            totalChunks: 0 
          }));

          const pagesPerChunk = apiProvider === 'gemini' ? GEMINI_PAGES_PER_CHUNK : GROQ_PAGES_PER_CHUNK;
          const chunks = await splitPdfIntoChunks(buffer, pagesPerChunk);
          
          controller.enqueue(encodeEvent({ 
            type: 'progress', 
            message: `Split PDF into ${chunks.length} chunks. Starting processing...`, 
            chunk: 0, 
            totalChunks: chunks.length 
          }));

          // Process Chunks
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            controller.enqueue(encodeEvent({ 
              type: 'progress', 
              message: `Processing chunk ${i + 1}/${chunks.length} (${apiProvider})...`, 
              chunk: i + 1, 
              totalChunks: chunks.length 
            }));

            let chunkSuccess = false;
            let retries = 0;
            const MAX_RETRIES = 2;

            while (!chunkSuccess && retries <= MAX_RETRIES) {
              try {
                let responseText = '';
                
                if (apiProvider === 'gemini') {
                  const base64Data = chunk.toString('base64');
                  responseText = await processChunkWithGemini(base64Data, effectiveApiKey, effectiveModelId, i + 1, chunks.length);
                } else {
                  const chunkText = await extractPdfText(chunk);
                  if (chunkText.trim().length < 20) {
                     // Empty chunk
                     responseText = '{"transactions": []}'; 
                  } else {
                    responseText = await processWithGroq(chunkText, effectiveApiKey, effectiveModelId);
                  }
                }

                const parsed = parseAIResponse(responseText);
                if (!bankName && parsed.bankName) bankName = parsed.bankName;

                const txArray = (parsed.transactions || []) as Array<Record<string, unknown>>;
                const chunkTransactions: Transaction[] = txArray.map((tx) => ({
                  id: generateId(),
                  date: parseDate(String(tx.date || '')),
                  description: String(tx.narration || tx.description || ''),
                  reference: String(tx.txn_no || tx.reference || tx.ref_no || ''),
                  debit: parseAmount(String(tx.debit ?? tx.withdrawal ?? 0)),
                  credit: parseAmount(String(tx.credit ?? tx.deposit ?? 0)),
                  balance: tx.balance != null ? parseAmount(String(tx.balance)) : undefined,
                  currency: 'INR',
                  bankName: bankName,
                }));

                // Send transactions immediately
                if (chunkTransactions.length > 0) {
                   controller.enqueue(encodeEvent({ type: 'transactions', data: chunkTransactions }));
                }

                chunkSuccess = true;

                // Delay
                const delay = apiProvider === 'gemini' ? 2000 : 5000;
                if (i < chunks.length - 1) {
                  controller.enqueue(encodeEvent({ 
                    type: 'progress', 
                    message: `Waiting ${delay/1000}s for rate limit...`, 
                    chunk: i + 1, 
                    totalChunks: chunks.length 
                  }));
                  await new Promise(resolve => setTimeout(resolve, delay));
                }

              } catch (error) {
                retries++;
                const errorMsg = error instanceof Error ? error.message : '';
                console.error(`Chunk ${i+1} retry ${retries} error:`, errorMsg);

                if (errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('rate_limit')) {
                  const waitTime = 32000;
                   controller.enqueue(encodeEvent({ 
                    type: 'progress', 
                    message: `Rate limited. Waiting ${waitTime/1000}s...`, 
                    chunk: i + 1, 
                    totalChunks: chunks.length 
                  }));
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  continue;
                }

                if (retries > MAX_RETRIES) {
                  warnings.push(`Skipped chunk ${i + 1} due to errors: ${errorMsg}`);
                  break;
                }
              }
            }
          }

          // Complete
          controller.enqueue(encodeEvent({ type: 'complete', warnings, bankName }));
          controller.close();

        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encodeEvent({ type: 'error', message: msg }));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('PDF parse error:', error);
    return NextResponse.json({ error: 'Failed to initiate processing' }, { status: 500 });
  }
}
