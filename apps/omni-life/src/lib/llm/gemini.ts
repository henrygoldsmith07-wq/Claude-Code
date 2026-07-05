import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMResponse } from './router';
import { getServiceCredential } from '../supabase/server'; // Assuming this utility exists
import { decrypt } from '../encryption';

export async function callGemini(prompt: string, userId: string): Promise<LLMResponse> {
  try {
    // Retrieve and decrypt API key for the user
    const credential = await getServiceCredential(userId, 'GOOGLE_GEMINI');
    if (!credential || !credential.encrypted_token) {
      throw new Error('Google Gemini API key not found for user.');
    }
    const apiKey = decrypt(credential.encrypted_token.api_key);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' }); // Or other appropriate Gemini model

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return {
      model: 'Gemini',
      response: text,
      usage: (response as { usageMetadata?: unknown }).usageMetadata,
    };
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    return {
      model: 'Gemini',
      response: '',
      error: error.message || 'Failed to get response from Gemini.',
    };
  }
}
