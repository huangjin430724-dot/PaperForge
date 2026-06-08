import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateMessageTokens,
  getTokenUsageStats,
  inferTaskComplexity,
  getOpenAICompatibleModelKwargs,
  normalizeBaseURL,
  normalizeChatEndpoint,
  normalizeThinkingMode,
  recordTokenUsage,
  resolveThinkingDecision,
  resolveLLMConfig,
  shouldDisableThinkingByDefault
} from './llmService.js';

test('normalizeChatEndpoint accepts full chat completion URLs', () => {
  assert.equal(
    normalizeChatEndpoint('https://example.com/v1/chat/completions'),
    'https://example.com/v1/chat/completions'
  );
});

test('normalizeChatEndpoint expands base URLs', () => {
  assert.equal(normalizeChatEndpoint('https://example.com'), 'https://example.com/v1/chat/completions');
  assert.equal(normalizeChatEndpoint('https://example.com/v1'), 'https://example.com/v1/chat/completions');
});

test('normalizeBaseURL strips chat completion suffixes', () => {
  assert.equal(normalizeBaseURL('https://example.com/v1/chat/completions'), 'https://example.com/v1');
});

test('resolveLLMConfig prefers explicit config over environment defaults', () => {
  const config = resolveLLMConfig({
    endpoint: ' https://api.example.com/v1 ',
    apiKey: ' test-key ',
    model: ' model-a '
  });

  assert.deepEqual(config, {
    endpoint: 'https://api.example.com/v1',
    apiKey: 'test-key',
    model: 'model-a',
    thinkingMode: 'auto',
    thinkingEnabled: false
  });
});

test('resolveLLMConfig preserves legacy thinkingEnabled as forced-on mode', () => {
  const config = resolveLLMConfig({
    endpoint: 'https://api.deepseek.com/v1',
    apiKey: 'test-key',
    model: 'deepseek-v4-flash',
    thinkingEnabled: true
  });

  assert.equal(config.thinkingMode, 'on');
  assert.equal(config.thinkingEnabled, true);
});

test('normalizeThinkingMode supports auto on and off', () => {
  assert.equal(normalizeThinkingMode('enabled'), 'on');
  assert.equal(normalizeThinkingMode('disabled'), 'off');
  assert.equal(normalizeThinkingMode('whatever'), 'auto');
});

test('shouldDisableThinkingByDefault detects DeepSeek thinking-capable models', () => {
  assert.equal(
    shouldDisableThinkingByDefault({
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-v4-flash'
    }),
    true
  );
  assert.equal(
    shouldDisableThinkingByDefault({
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      model: 'deepseek-v3.2-251201'
    }),
    true
  );
});

test('getOpenAICompatibleModelKwargs disables thinking only for compatible providers', () => {
  assert.deepEqual(
    getOpenAICompatibleModelKwargs({
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-v4-pro'
    }),
    { thinking: { type: 'disabled' } }
  );
  assert.deepEqual(
    getOpenAICompatibleModelKwargs({
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-v4-pro',
      thinkingEnabled: true
    }),
    { thinking: { type: 'enabled' } }
  );
  assert.deepEqual(
    getOpenAICompatibleModelKwargs({
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini'
    }),
    {}
  );
});

test('estimateMessageTokens counts strings and multimodal message parts', () => {
  assert.ok(estimateMessageTokens([{ role: 'user', content: 'hello world' }]) >= 2);
  assert.ok(estimateMessageTokens([{ role: 'user', content: [{ type: 'text', text: '公式识别' }, { type: 'image_url' }] }]) >= 2);
});

test('inferTaskComplexity and resolveThinkingDecision enable thinking for complex compatible tasks only', () => {
  assert.equal(inferTaskComplexity({ task: 'review paper', messages: [] }), 'complex');
  assert.equal(inferTaskComplexity({ task: 'autocomplete', messages: [{ content: 'abc' }] }), 'simple');

  const complex = resolveThinkingDecision({
    llmConfig: { thinkingMode: 'auto' },
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-v4-flash',
    task: 'review paper',
    messages: [{ role: 'user', content: 'please review' }]
  });
  assert.equal(complex.enabled, true);
  assert.equal(complex.reason, 'auto-complex-task');

  const simple = resolveThinkingDecision({
    llmConfig: { thinkingMode: 'auto' },
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-v4-flash',
    task: 'autocomplete',
    messages: [{ role: 'user', content: 'abc' }]
  });
  assert.equal(simple.enabled, false);
  assert.equal(simple.reason, 'auto-save-tokens');
});

test('recordTokenUsage aggregates recent usage stats', () => {
  const before = getTokenUsageStats().calls;
  recordTokenUsage({
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-v4-flash',
    task: 'review',
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    thinking: { enabled: true }
  });
  const after = getTokenUsageStats();
  assert.equal(after.calls, before + 1);
  assert.equal(after.recent[0].provider, 'api.deepseek.com');
  assert.equal(after.recent[0].thinking.enabled, true);
});
