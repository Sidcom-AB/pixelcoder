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

/**
 * Multi-turn tool-use conversation loop.
 * Calls Claude, executes tools, feeds results back until Claude sends end_turn.
 *
 * @param {Function} options.onTurn - Called after each API turn with log data for immediate persistence.
 *   Signature: async (logEntry) => void
 * @returns {{ text: string, totalTokens: number }}
 */
async function callClaudeWithTools(systemPrompt, userMessage, tools, toolExecutor, options = {}) {
  const settings = require('../shared/settings');
  const model = options.model || await settings.get('claude_model');
  const maxTokens = options.maxTokens || 16384;
  const maxTurns = options.maxTurns || 25;
  const onTurn = options.onTurn || (() => {});

  const messages = [{ role: 'user', content: userMessage }];
  let totalTokens = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    const start = Date.now();

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools,
      messages,
    });

    const durationMs = Date.now() - start;
    const tokens = response.usage.input_tokens + response.usage.output_tokens;
    totalTokens += tokens;

    // Extract text content for logging
    const textBlocks = response.content.filter(b => b.type === 'text').map(b => b.text);
    const toolCalls = response.content.filter(b => b.type === 'tool_use');

    // Build prompt_sent for this turn
    let promptSent;
    if (turn === 0) {
      promptSent = `[system]\n${systemPrompt.substring(0, 2000)}\n\n[user]\n${userMessage}`;
    } else {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg?.role === 'user' && Array.isArray(lastUserMsg.content)) {
        promptSent = lastUserMsg.content
          .filter(b => b.type === 'tool_result')
          .map(b => `[tool_result ${b.tool_use_id}]\n${String(b.content).substring(0, 500)}`)
          .join('\n\n');
      }
    }

    // Log this turn immediately
    await onTurn({
      step_number: turn + 1,
      prompt_sent: promptSent || null,
      response_raw: textBlocks.join('\n') || (toolCalls.length > 0
        ? toolCalls.map(t => `[tool_use: ${t.name}(${JSON.stringify(t.input).substring(0, 200)})]`).join('\n')
        : '(empty)'),
      tokens_used: tokens,
      duration_ms: durationMs,
    });

    // Append assistant message to conversation
    messages.push({ role: 'assistant', content: response.content });

    // Done — Claude finished with text response
    if (response.stop_reason === 'end_turn') {
      const finalText = textBlocks.join('\n');
      return { text: finalText, totalTokens };
    }

    // Tool use — execute and continue
    if (response.stop_reason === 'tool_use') {
      const toolResults = [];
      for (const block of toolCalls) {
        console.log(`[claude] Tool call: ${block.name}(${JSON.stringify(block.input).substring(0, 100)})`);
        const result = await toolExecutor(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unexpected stop reason
    console.warn(`[claude] Unexpected stop_reason: ${response.stop_reason}`);
    return { text: textBlocks.join('\n') || '', totalTokens };
  }

  console.warn(`[claude] Hit max turns (${maxTurns})`);
  return { text: '(max turns reached)', totalTokens };
}

module.exports = { callClaude, callClaudeWithTools };
