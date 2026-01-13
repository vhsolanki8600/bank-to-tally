import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { generateId, parseDate, parseAmount } from '@/lib/utils';
import type { Transaction, ParseResult } from '@/lib/schema';
import { IMAGE_EXTRACTION_PROMPT } from '@/lib/ai/prompts';

/**
 * Process image with Gemini Vision
 */
async function processWithGemini(base64Data: string, mimeType: string, apiKey: string, modelId: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  const result = await model.generateContent([
    IMAGE_EXTRACTION_PROMPT,
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    },
  ]);

  return result.response.text();
}

/**
 * Process image with Groq Vision
 */
async function processWithGroqVision(base64Data: string, mimeType: string, apiKey: string, modelId: string): Promise<string> {
  const groq = new Groq({ apiKey });
  
  const completion = await groq.chat.completions.create({
    model: modelId,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: IMAGE_EXTRACTION_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 8000,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Parse AI response to extract transactions
 */
function parseAIResponse(responseText: string): { transactions: unknown[]; bankName?: string } {
  if (!responseText || responseText.trim().length === 0) {
    throw new Error('AI returned empty response');
  }
  
  let jsonStr = responseText;

  // Handle markdown code blocks
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Find JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  } else {
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return { transactions: JSON.parse(arrayMatch[0]) };
    }
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    const fallbackMatch = responseText.match(/"transactions"\s*:\s*(\[[\s\S]*?\])/);
    if (fallbackMatch) {
      try { return { transactions: JSON.parse(fallbackMatch[1]) }; } catch {}
    }
    throw new Error('Could not parse AI response as JSON');
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    // Get config from frontend
    const apiProvider = formData.get('apiProvider') as string || 'gemini';
    const apiKey = formData.get('apiKey') as string || '';
    const modelId = formData.get('modelId') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const effectiveApiKey = apiKey || (apiProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY);
    const effectiveModelId = modelId || (apiProvider === 'gemini' ? 'gemini-2.5-flash' : 'meta-llama/llama-4-scout-17b-16e-instruct');

    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: `No ${apiProvider === 'gemini' ? 'Gemini' : 'Groq'} API key provided.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    let responseText: string;
    let usedProvider: string;

    if (apiProvider === 'gemini') {
      try {
        console.log(`Processing image with Gemini (${effectiveModelId})...`);
        responseText = await processWithGemini(base64Data, mimeType, effectiveApiKey, effectiveModelId);
        usedProvider = `Gemini (${effectiveModelId})`;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg.includes('429')) {
          return NextResponse.json(
            { error: 'Gemini rate limit exceeded. Wait and try again.' },
            { status: 429 }
          );
        }
        throw error;
      }
    } else {
      // Groq Vision
      try {
        console.log(`Processing image with Groq Vision (${effectiveModelId})...`);
        responseText = await processWithGroqVision(base64Data, mimeType, effectiveApiKey, effectiveModelId);
        usedProvider = `Groq Vision (${effectiveModelId})`;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '';
        console.error('Groq Vision error:', errorMsg);
        return NextResponse.json(
          { error: `Groq Vision failed: ${errorMsg}` },
          { status: 400 }
        );
      }
    }

    console.log(`${usedProvider} response received`);

    // Parse response
    let parsed;
    try {
      parsed = parseAIResponse(responseText);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      return NextResponse.json(
        { error: `AI returned invalid format. Provider: ${usedProvider}` },
        { status: 500 }
      );
    }

    // Convert to transactions
    const txArray = (parsed.transactions || []) as Array<Record<string, unknown>>;
    const transactions: Transaction[] = txArray.map((tx) => ({
      id: generateId(),
      date: parseDate(String(tx.date || '')),
      description: String(tx.narration || tx.description || ''),
      reference: String(tx.txn_no || tx.reference || tx.ref_no || ''),
      debit: parseAmount(String(tx.debit ?? tx.withdrawal ?? 0)),
      credit: parseAmount(String(tx.credit ?? tx.deposit ?? 0)),
      balance: tx.balance != null ? parseAmount(String(tx.balance)) : undefined,
      currency: 'INR',
      bankName: parsed.bankName,
    }));

    const warnings: string[] = [];
    if (transactions.length === 0) {
      warnings.push('No transactions found in the image');
    }
    warnings.push(`Processed with: ${usedProvider}`);

    const result: ParseResult = {
      transactions,
      warnings,
      bankName: parsed.bankName,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Image parse error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to process image: ${errorMessage}` }, { status: 500 });
  }
}
