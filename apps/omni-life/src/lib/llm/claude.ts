import Anthropic from '@anthropic-ai/sdk';
import { LLMResponse } from './router';
import { getServiceCredential } from '../supabase/server'; // Assuming this utility exists
import { decrypt } from '../encryption';

export async function callClaude(prompt: string, userId: string): Promise<LLMResponse> {
  try {
    // Retrieve and decrypt API key for the user
    const credential = await getServiceCredential(userId, 'ANTHROPIC');
    if (!credential || !credential.encrypted_token) {
      throw new Error('Anthropic API key not found for user.');
    }
    const apiKey = decrypt(credential.encrypted_token.api_key);

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229', // Or other appropriate Claude model
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');

    return {
      model: 'Claude',
      response: textBlock && textBlock.type === 'text' ? textBlock.text : '',
      usage: response.usage,
    };
  } catch (error: any) {
    console.error('Error calling Claude API:', error);
    return {
      model: 'Claude',
      response: '',
      error: error.message || 'Failed to get response from Claude.',
    };
  }
}
