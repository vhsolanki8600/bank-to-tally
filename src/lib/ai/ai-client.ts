import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { buildExtractionPrompt } from './prompts';

export type AIProvider = 'gemini' | 'groq' | 'none';

interface AIConfig {
  provider: AIProvider;
  geminiApiKey?: string;
  geminiModel?: string;
  groqApiKey?: string;
  groqModel?: string;
}

interface ExtractionResult {
  transactions: Array<{
    date: string;
    narration: string;
    txn_no?: string;
    debit: number;
    credit: number;
    balance?: number;
  }>;
  bankName?: string;
  accountNumber?: string;
  confidence?: number;
}

/**
 * Get AI configuration from environment variables
 */
export function getAIConfig(): AIConfig {
  return {
    provider: (process.env.AI_PROVIDER as AIProvider) || 'none',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
  };
}

/**
 * Check if AI is available and configured
 */
export function isAIAvailable(): boolean {
  const config = getAIConfig();
  if (config.provider === 'none') return false;
  if (config.provider === 'gemini' && config.geminiApiKey) return true;
  if (config.provider === 'groq' && config.groqApiKey) return true;
  return false;
}

/**
 * Extract transactions using Gemini API
 */
async function extractWithGemini(
  content: string,
  config: AIConfig,
  isImage: boolean = false,
  imageData?: { base64: string; mimeType: string }
): Promise<ExtractionResult> {
  if (!config.geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: config.geminiModel || 'gemini-1.5-flash' });

  let result;
  
  if (isImage && imageData) {
    // Vision API for images
    const prompt = buildExtractionPrompt('', true);
    result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData.base64,
          mimeType: imageData.mimeType,
        },
      },
    ]);
  } else {
    // Text extraction
    const prompt = buildExtractionPrompt(content, false);
    result = await model.generateContent(prompt);
  }

  const text = result.response.text();
  return parseAIResponse(text);
}

/**
 * Extract transactions using Groq API
 */
async function extractWithGroq(
  content: string,
  config: AIConfig
): Promise<ExtractionResult> {
  if (!config.groqApiKey) {
    throw new Error('Groq API key not configured');
  }

  const groq = new Groq({ apiKey: config.groqApiKey });
  const prompt = buildExtractionPrompt(content, false);

  const completion = await groq.chat.completions.create({
    model: config.groqModel || 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1,
    max_tokens: 8000,
  });

  const text = completion.choices[0]?.message?.content || '';
  return parseAIResponse(text);
}

/**
 * Parse AI response to structured data
 */
function parseAIResponse(text: string): ExtractionResult {
  // Try to extract JSON from the response
  let jsonStr = text;
  
  // Handle markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  // Try to find JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    
    // Normalize the response
    const transactions = (parsed.transactions || []).map((tx: Record<string, unknown>) => ({
      date: String(tx.date || ''),
      narration: String(tx.narration || tx.description || ''),
      txn_no: String(tx.txn_no || tx.reference || tx.ref_no || ''),
      debit: Number(tx.debit || tx.withdrawal || 0),
      credit: Number(tx.credit || tx.deposit || 0),
      balance: tx.balance !== undefined ? Number(tx.balance) : undefined,
    }));

    return {
      transactions,
      bankName: parsed.bankName || parsed.bank_name,
      accountNumber: parsed.accountNumber || parsed.account_number,
      confidence: parsed.confidence,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    throw new Error('Failed to parse AI extraction response');
  }
}

/**
 * Main extraction function - uses configured AI provider
 */
export async function extractWithAI(
  content: string,
  options?: {
    isImage?: boolean;
    imageData?: { base64: string; mimeType: string };
  }
): Promise<ExtractionResult> {
  const config = getAIConfig();

  if (config.provider === 'none' || !isAIAvailable()) {
    throw new Error('AI provider not configured');
  }

  if (config.provider === 'gemini') {
    return extractWithGemini(
      content,
      config,
      options?.isImage,
      options?.imageData
    );
  }

  if (config.provider === 'groq') {
    return extractWithGroq(content, config);
  }

  throw new Error(`Unknown AI provider: ${config.provider}`);
}

/**
 * Extract from image using AI vision
 */
export async function extractFromImage(
  base64Data: string,
  mimeType: string
): Promise<ExtractionResult> {
  const config = getAIConfig();

  if (config.provider !== 'gemini') {
    throw new Error('Image extraction requires Gemini with vision capabilities');
  }

  return extractWithGemini('', config, true, { base64: base64Data, mimeType });
}
