export function normalizeChatEndpoint(endpoint) {
  if (!endpoint) return 'https://api.openai.com/v1/chat/completions';
  let url = endpoint.trim();
  if (!url) return 'https://api.openai.com/v1/chat/completions';
  url = url.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(url)) return url;
  if (/\/v1$/i.test(url)) return `${url}/chat/completions`;
  if (/\/v1\//i.test(url)) return url;
  return `${url}/v1/chat/completions`;
}

const tokenUsageLog = [];
const MAX_USAGE_LOG = 200;

export function normalizeBaseURL(endpoint) {
  if (!endpoint) return undefined;
  const trimmed = endpoint.replace(/\/+$/, '');
  return trimmed.replace(/\/chat\/completions$/i, '');
}

export function resolveLLMConfig(llmConfig) {
  const envThinking = String(process.env.PaperForge_LLM_THINKING || '').toLowerCase();
  const envThinkingEnabled = ['1', 'true', 'yes', 'on'].includes(envThinking);
  const thinkingMode = normalizeThinkingMode(
    llmConfig?.thinkingMode ||
    (llmConfig?.thinkingEnabled === true ? 'on' : '') ||
    (envThinkingEnabled ? 'on' : '') ||
    process.env.PaperForge_LLM_THINKING_MODE
  );
  return {
    endpoint: (llmConfig?.endpoint || process.env.PaperForge_LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions').trim(),
    apiKey: (llmConfig?.apiKey || process.env.PaperForge_LLM_API_KEY || '').trim(),
    model: (llmConfig?.model || process.env.PaperForge_LLM_MODEL || 'gpt-4o-mini').trim(),
    thinkingMode,
    thinkingEnabled: thinkingMode === 'auto'
      ? (llmConfig?.thinkingEnabled === true || envThinkingEnabled)
      : thinkingMode === 'on'
  };
}

export function normalizeThinkingMode(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (['on', 'enabled', 'true', '1', 'yes'].includes(raw)) return 'on';
  if (['off', 'disabled', 'false', '0', 'no'].includes(raw)) return 'off';
  return 'auto';
}

export function shouldDisableThinkingByDefault({ endpoint = '', model = '' } = {}) {
  const lowerEndpoint = String(endpoint || '').toLowerCase();
  const lowerModel = String(model || '').toLowerCase();
  const isDeepSeekEndpoint = lowerEndpoint.includes('deepseek.com');
  const isArkEndpoint = lowerEndpoint.includes('ark.cn-') || lowerEndpoint.includes('volces.com');
  const isDeepSeekThinkingCapableModel =
    lowerModel.includes('deepseek-v4') ||
    lowerModel.includes('deepseek-v3.2') ||
    lowerModel.includes('deepseek-reasoner');

  return isDeepSeekThinkingCapableModel || ((isDeepSeekEndpoint || isArkEndpoint) && lowerModel.includes('deepseek'));
}

export function getOpenAICompatibleModelKwargs({ endpoint = '', model = '', thinkingEnabled = false } = {}) {
  if (!shouldDisableThinkingByDefault({ endpoint, model })) return {};
  return { thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' } };
}

export function estimateMessageTokens(messages = []) {
  const contentToText = (content) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return String(part.text || '');
        if (part?.type === 'image_url') return '[image]';
        return JSON.stringify(part || '');
      }).join('\n');
    }
    return String(content || '');
  };
  const text = Array.isArray(messages)
    ? messages.map((message) => contentToText(message?.content)).join('\n')
    : String(messages || '');
  const cjkChars = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const asciiChars = text.length - cjkChars;
  return Math.max(1, Math.ceil(cjkChars * 0.65 + asciiChars / 4));
}

export function inferTaskComplexity({ task = '', messages = [], tokenEstimate } = {}) {
  const estimated = Number.isFinite(tokenEstimate) ? tokenEstimate : estimateMessageTokens(messages);
  const lowerTask = String(task || '').toLowerCase();
  const joined = Array.isArray(messages)
    ? messages.map((message) => String(message?.content || '')).join('\n').toLowerCase()
    : '';
  const complexSignals = [
    'review',
    'peer',
    'consistency',
    'citation',
    'compile',
    'fix',
    'diagnose',
    'agent',
    'tools',
    'transfer',
    'layout',
    'reason',
    '评审',
    '审稿',
    '一致性',
    '引用',
    '编译',
    '修复',
    '诊断',
    '迁移',
    '布局'
  ];
  const simpleSignals = ['autocomplete', 'translate', 'polish', 'rewrite', 'chat', '补全', '翻译', '润色', '改写'];
  if (complexSignals.some((signal) => lowerTask.includes(signal) || joined.includes(signal))) return 'complex';
  if (estimated >= 3500) return 'complex';
  if (estimated >= 1400) return 'medium';
  if (simpleSignals.some((signal) => lowerTask.includes(signal))) return 'simple';
  return 'simple';
}

export function resolveThinkingDecision({ llmConfig, endpoint = '', model = '', messages = [], task = '' } = {}) {
  const mode = normalizeThinkingMode(llmConfig?.thinkingMode);
  const tokenEstimate = estimateMessageTokens(messages);
  const complexity = inferTaskComplexity({ task, messages, tokenEstimate });

  if (mode === 'on') {
    return { enabled: true, mode, complexity, tokenEstimate, reason: 'user-forced-on' };
  }
  if (mode === 'off') {
    return { enabled: false, mode, complexity, tokenEstimate, reason: 'user-forced-off' };
  }

  const supportsProviderThinking = shouldDisableThinkingByDefault({ endpoint, model });
  const enabled = supportsProviderThinking && complexity === 'complex';
  return {
    enabled,
    mode: 'auto',
    complexity,
    tokenEstimate,
    reason: enabled ? 'auto-complex-task' : 'auto-save-tokens'
  };
}

export function recordTokenUsage({ endpoint = '', model = '', task = '', usage = null, thinking = null } = {}) {
  const provider = (() => {
    try {
      return new URL(normalizeChatEndpoint(endpoint)).host;
    } catch {
      return '';
    }
  })();
  tokenUsageLog.push({
    at: new Date().toISOString(),
    provider,
    model,
    task,
    usage,
    thinking
  });
  if (tokenUsageLog.length > MAX_USAGE_LOG) {
    tokenUsageLog.splice(0, tokenUsageLog.length - MAX_USAGE_LOG);
  }
}

export function getTokenUsageStats() {
  const total = tokenUsageLog.reduce((acc, item) => {
    const usage = item.usage || {};
    acc.promptTokens += Number(usage.prompt_tokens || usage.input_tokens || 0);
    acc.completionTokens += Number(usage.completion_tokens || usage.output_tokens || 0);
    acc.totalTokens += Number(usage.total_tokens || 0);
    acc.calls += 1;
    if (item.thinking?.enabled) acc.thinkingCalls += 1;
    if (item.thinking?.fallbackFromThinking) acc.thinkingFallbacks += 1;
    return acc;
  }, {
    calls: 0,
    thinkingCalls: 0,
    thinkingFallbacks: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  });

  return {
    ...total,
    recent: tokenUsageLog.slice(-50).reverse()
  };
}

export async function callOpenAICompatible({ messages, model, endpoint, apiKey, thinkingEnabled, thinkingMode, task }) {
  const finalEndpoint = normalizeChatEndpoint(endpoint || process.env.PaperForge_LLM_ENDPOINT);
  const finalApiKey = (apiKey || process.env.PaperForge_LLM_API_KEY || '').trim();
  const finalModel = (model || process.env.PaperForge_LLM_MODEL || 'gpt-4o-mini').trim();
  const decision = resolveThinkingDecision({
    llmConfig: { thinkingMode: thinkingMode ?? (thinkingEnabled === true ? 'on' : 'auto') },
    endpoint: finalEndpoint,
    model: finalModel,
    messages,
    task
  });

  if (!finalApiKey) {
    return { ok: false, error: 'PaperForge_LLM_API_KEY not set' };
  }

  const send = async (useThinking) => {
    const modelKwargs = getOpenAICompatibleModelKwargs({
      endpoint: finalEndpoint,
      model: finalModel,
      thinkingEnabled: useThinking
    });
    return fetch(finalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages,
        temperature: 0.2,
        ...modelKwargs
      })
    });
  };

  let res = await send(decision.enabled);

  const text = await res.text();
  if (!res.ok) {
    if (decision.enabled && /reasoning_content|thinking mode/i.test(text)) {
      res = await send(false);
      const retryText = await res.text();
      if (!res.ok) {
        return { ok: false, error: retryText || `Request failed with ${res.status}` };
      }
      return parseOpenAICompatibleResponse(res, retryText, {
        ...decision,
        enabled: false,
        fallbackFromThinking: true,
        reason: 'provider-rejected-thinking'
      }, { endpoint: finalEndpoint, model: finalModel, task });
    }
    return { ok: false, error: text || `Request failed with ${res.status}` };
  }
  return parseOpenAICompatibleResponse(res, text, decision, { endpoint: finalEndpoint, model: finalModel, task });
}

function parseOpenAICompatibleResponse(res, text, thinkingDecision, meta = {}) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { ok: false, error: text || 'Non-JSON response from provider.' };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Response JSON parse failed.' };
  }
  const content = data?.choices?.[0]?.message?.content || '';
  const usage = data?.usage || null;
  recordTokenUsage({
    endpoint: meta.endpoint,
    model: meta.model,
    task: meta.task,
    usage,
    thinking: thinkingDecision || null
  });
  return {
    ok: true,
    content,
    usage,
    thinking: thinkingDecision || null
  };
}

