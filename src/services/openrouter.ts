/**
 * OpenRouter API Service
 *
 * Handles all OpenRouter API interactions including:
 * - Fetching available models
 * - Streaming chat completions
 */

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  id: string;
  choices: {
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
    index: number;
  }[];
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CompletionResult {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latency_ms: number;
  model: string;
  error?: string;
}

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

/**
 * Fetch all available models from OpenRouter
 */
export async function fetchModels(apiKey: string): Promise<OpenRouterModel[]> {
  const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/dotnetfactory/ai-comps',
      'X-Title': 'AI Model Comparison Tool',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OpenRouterModelsResponse;
  return data.data;
}

/**
 * Stream a chat completion from OpenRouter
 */
export async function* streamCompletion(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/dotnetfactory/ai-comps',
      'X-Title': 'AI Model Comparison Tool',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            return;
          }
          try {
            const chunk = JSON.parse(data) as StreamChunk;
            yield chunk;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get a non-streaming completion
 */
export async function getCompletion(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<CompletionResult> {
  const startTime = Date.now();

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/dotnetfactory/ai-comps',
      'X-Title': 'AI Model Comparison Tool',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  const latency_ms = Date.now() - startTime;

  if (!response.ok) {
    const error = await response.text();
    return {
      content: '',
      latency_ms,
      model,
      error: `API error: ${response.status} - ${error}`,
    };
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
    latency_ms,
    model,
  };
}

/**
 * Calculate cost based on token usage and model pricing
 */
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  promptPrice: string,
  completionPrice: string
): number {
  const promptCost = (promptTokens / 1_000_000) * parseFloat(promptPrice);
  const completionCost = (completionTokens / 1_000_000) * parseFloat(completionPrice);
  return promptCost + completionCost;
}
