import 'server-only';
import OpenAI from 'openai';
export function aiConfiguration() {
  const provider = process.env.AI_PROVIDER || 'openai';
  if (!['openai','xai'].includes(provider)) throw new Error('Unsupported AI provider.');
  return provider === 'openai'
    ? { provider, model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', apiKey: process.env.OPENAI_API_KEY, baseURL:'https://api.openai.com/v1' }
    : { provider, model: process.env.XAI_MODEL || 'grok-4.3', apiKey: process.env.XAI_API_KEY, baseURL:'https://api.x.ai/v1' };
}
export async function generateResponse(messages: {sender:'user'|'ai';content:string}[], context?: string | null) {
  const configuration = aiConfiguration();
  if (!configuration.apiKey) throw new Error('AI is not configured yet. Please try again later.');
  const client = new OpenAI({apiKey:configuration.apiKey,baseURL:configuration.baseURL,timeout:60000,maxRetries:1});
  try {
    if (configuration.provider === 'openai') {
      const result = await client.responses.create({model:configuration.model,store:false,max_output_tokens:2048,instructions:context ? `Use the following user-supplied reference when relevant:\n${context}` : undefined,input:messages.map(message=>({role:message.sender==='user'?'user' as const:'assistant' as const,content:message.content}))});
      if (!result.output_text?.trim()) throw new Error('The AI returned an empty response. Please try again.');
      return result.output_text;
    }
    const result = await client.chat.completions.create({model:configuration.model,messages:[...(context ? [{role:'system' as const,content:`Use this user-supplied reference when relevant:\n${context}`}] : []),...messages.map(message=>({role:message.sender==='user'?'user' as const:'assistant' as const,content:message.content}))]});
    const text = result.choices[0]?.message.content;
    if (!text?.trim()) throw new Error('The AI returned an empty response. Please try again.');
    return text;
  } catch(error) {
    if (error instanceof OpenAI.APIError) throw new Error(error.status===429 ? 'The AI service is busy. Please try again shortly.' : 'The AI service is temporarily unavailable. Please try again later.');
    throw error;
  }
}
