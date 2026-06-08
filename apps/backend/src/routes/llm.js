import { callOpenAICompatible, getTokenUsageStats } from '../services/llmService.js';

export function registerLLMRoutes(fastify) {
  fastify.get('/api/llm/usage', async () => getTokenUsageStats());

  fastify.post('/api/llm', async (req) => {
    const { messages, model, llmConfig } = req.body || {};
    const result = await callOpenAICompatible({
      messages,
      model: llmConfig?.model || model,
      endpoint: llmConfig?.endpoint,
      apiKey: llmConfig?.apiKey,
      thinkingEnabled: llmConfig?.thinkingEnabled,
      thinkingMode: llmConfig?.thinkingMode,
      task: llmConfig?.task || req.body?.task
    });
    return result;
  });
}
