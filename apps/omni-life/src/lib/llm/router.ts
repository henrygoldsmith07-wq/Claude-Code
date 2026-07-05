import { callClaude } from './claude';
import { callGemini } from './gemini';
import { callChatGPT } from './chatgpt';

export type LLMTaskType = 'reasoning' | 'context_scanning' | 'execution';

export interface LLMResponse {
  model: string;
  response: string;
  usage?: any; // Depending on the LLM API response structure
  error?: string;
}

export async function routeToLLM(taskType: LLMTaskType, prompt: string, userId: string): Promise<LLMResponse> {
  try {
    switch (taskType) {
      case 'reasoning':
        return await callClaude(prompt, userId);
      case 'context_scanning':
        return await callGemini(prompt, userId);
      case 'execution':
        return await callChatGPT(prompt, userId);
      default:
        throw new Error(`Unknown LLM task type: ${taskType}`);
    }
  } catch (error: any) {
    console.error(`Error routing to LLM for task type ${taskType}:`, error);
    return {
      model: 'N/A',
      response: '',
      error: error.message || 'An unknown error occurred during LLM routing.',
    };
  }
}
