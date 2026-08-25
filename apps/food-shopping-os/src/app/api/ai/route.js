import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { ApiError, assertSameOrigin, handleApiError, rateLimit, requireUser } from '../../../server/api.js';
import { requireHousehold } from '../../../server/households.js';
import { aiRequestSchema } from '../../../server/schemas.js';
import { isOpenRouterConfigured, freeChat } from '../../../server/openrouter.js';
import { youthAiGate, validateAiResponseForYouth } from '../../../server/youth-ai.js';
import {
  releaseAiBudget, reserveAiBudget, settleAiBudget, tokenReservation,
} from '../../../server/ai-budget.js';

const system = `You are Forq, a UK food shopping assistant. Use UK English.
Treat allergy and health information as constraints, never diagnoses.
Do not invent live prices, stock, offers or retailer availability.
Return concise JSON with keys "answer", "suggestions" and "warnings".`;

export async function POST(request) {
  let reservation;
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await rateLimit(`ai:${user.id}`, isOpenRouterConfigured() ? 200 : 30, 3600000);
    if (!isOpenRouterConfigured() && !process.env.OPENAI_API_KEY) throw new ApiError(503, 'AI is not configured.');
    const { household } = await requireHousehold(user, request.headers.get('x-forq-household-id'));
    const input = aiRequestSchema.parse(await request.json());

    // Youth-safety gate: derive policy server-side, filter context, check prompt.
    const state = input.context?.state || {};
    const gate = youthAiGate({ state, prompt: input.prompt, context: input.context });
    if (!gate.allowed) throw new ApiError(422, gate.reason);
    const effectiveSystem = gate.youthSystemAddition ? `${system}\n${gate.youthSystemAddition}` : system;

    if (isOpenRouterConfigured()) {
      try {
        const { text } = await freeChat({
          system: effectiveSystem,
          user: JSON.stringify({ task: input.task, prompt: input.prompt, context: gate.filteredContext || {} }),
        });
        // Validate response against youth policy before returning.
        if (gate.policy.isYouth) {
          const check = validateAiResponseForYouth(text, gate.policy);
          return NextResponse.json({ output: check.sanitized || text, provider: 'openrouter-free', youthSafe: check.safe, youthViolations: check.violations.length || undefined });
        }
        return NextResponse.json({ output: text, provider: 'openrouter-free' });
      } catch (error) {
        if (error?.status !== 402 && error?.message !== 'no-free-model') throw error;
      }
    }

    reservation = await reserveAiBudget(household._id, tokenReservation(input, 1200, system.length));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: [
        { role: 'system', content: effectiveSystem },
        {
          role: 'user',
          content: JSON.stringify({ task: input.task, prompt: input.prompt, context: gate.filteredContext || {} }),
        },
      ],
      max_output_tokens: 1200,
    });
    await settleAiBudget(reservation, response.usage?.total_tokens);
    reservation = null;

    // Validate response against youth policy before returning.
    if (gate.policy.isYouth) {
      const check = validateAiResponseForYouth(response.output_text, gate.policy);
      return NextResponse.json({ output: check.sanitized || response.output_text, youthSafe: check.safe, youthViolations: check.violations.length || undefined });
    }
    return NextResponse.json({ output: response.output_text });
  } catch (error) {
    try {
      await releaseAiBudget(reservation);
    } catch (releaseError) {
      if (releaseError?.code !== 'HOUSEHOLD_DELETING') console.error('AI budget release failed', releaseError);
    }
    return handleApiError(error);
  }
}
