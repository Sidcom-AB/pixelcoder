const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

async function callClaude(systemPrompt, userMessage, options = {}) {
  const settings = require('../shared/settings');
  const model = options.model || await settings.get('claude_model');
  const maxTokens = options.maxTokens || 16384;

  const start = Date.now();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const durationMs = Date.now() - start;
  const content = response.content[0].text;
  const usage = response.usage;
  const stopReason = response.stop_reason;

  if (stopReason === 'max_tokens') {
    console.warn(`[claude] Response truncated (hit ${maxTokens} max_tokens)`);
  }

  return {
    content,
    stopReason,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    },
    durationMs,
  };
}

module.exports = { callClaude };
