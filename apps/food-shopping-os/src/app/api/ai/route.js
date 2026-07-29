import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { ApiError, assertSameOrigin, handleApiError, rateLimit, requireUser } from '../../../server/api.js';
import { requireHousehold } from '../../../server/households.js';
import { aiRequestSchema } from '../../../server/schemas.js';

const system = `You are Forq, a UK food shopping assistant. Use UK English.
Treat allergy and health information as constraints, never diagnoses.
Do not invent live prices, stock, offers or retailer availability.
Return concise JSON with keys "answer", "suggestions" and "warnings".`;

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await rateLimit(`ai:${user.id}`, 30, 3600000);
    if (!process.env.OPENAI_API_KEY) throw new ApiError(503, 'AI is not configured.');
    await requireHousehold(user, request.headers.get('x-forq-household-id'));
    const input = aiRequestSchema.parse(await request.json());
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: JSON.stringify({ task: input.task, prompt: input.prompt, context: input.context || {} }),
        },
      ],
      max_output_tokens: 1200,
    });
    return NextResponse.json({ output: response.output_text });
  } catch (error) {
    return handleApiError(error);
  }
}
