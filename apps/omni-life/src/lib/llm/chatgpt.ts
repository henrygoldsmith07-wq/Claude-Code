import OpenAI from 'openai';
import { LLMResponse } from './router';
import { getServiceCredential } from '../supabase/server'; // Assuming this utility exists
import { decrypt } from '../encryption';

export async function callChatGPT(prompt: string, userId: string): Promise<LLMResponse> {
  try {
    // Retrieve and decrypt API key for the user
    const credential = await getServiceCredential(userId, 'OPENAI');
    if (!credential || !credential.encrypted_token) {
      throw new Error('OpenAI API key not found for user.');
    }
    const apiKey = decrypt(credential.encrypted_token.api_key);

    const openai = new OpenAI({ apiKey });

    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4o', // Or other appropriate ChatGPT model
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      model: 'ChatGPT',
      response: chatCompletion.choices[0].message.content || '',
      usage: chatCompletion.usage,
    };
  } catch (error: any) {
    console.error('Error calling ChatGPT API:', error);
    return {
      model: 'ChatGPT',
      response: '',
      error: error.message || 'Failed to get response from ChatGPT.',
    };
  }
}
