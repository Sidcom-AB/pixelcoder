const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

async function callClaude(systemPrompt, userMessage, options = {}) {
  const model = options.model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  const maxTokens = options.maxTokens || 4096;

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

  return {
    content,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    },
    durationMs,
  };
}

module.exports = { callClaude };
