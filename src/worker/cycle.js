const db = require('../shared/db');
const settings = require('../shared/settings');
const { callClaude } = require('./claude');
const { buildPrompt, buildFollowUpPrompt } = require('./prompts');

const MAX_LARGE_STEPS = 3;

/**
 * Get today's token usage from cycle_logs.
 */
async function getTodayTokenUsage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ total }] = await db('cycle_logs')
    .where('created_at', '>=', todayStart)
    .sum('tokens_used as total');

  return parseInt(total) || 0;
}

/**
 * Calculate budget info for the prompt.
 * Returns { used, budget, percent, energyLevel }
 */
async function getBudgetInfo() {
  const used = await getTodayTokenUsage();
  const budget = parseInt(await settings.get('daily_token_budget'));
  const percent = Math.round((used / budget) * 100);
  let energyLevel;

  if (percent < 40) energyLevel = 'full';
  else if (percent < 70) energyLevel = 'good';
  else if (percent < 90) energyLevel = 'low';
  else energyLevel = 'exhausted';

  return { used, budget, percent, energyLevel };
}

async function getDayNumber() {
  const startStr = await settings.get('start_date');
  const [y, m, d] = startStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = now - start;
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

async function getCurrentContent() {
  const rev = await db('revisions')
    .whereNotNull('html')
    .orderBy('id', 'desc')
    .first();

  return {
    html: rev?.html || null,
    css: rev?.css || null,
    js: rev?.js || null,
  };
}

async function getRecentJournal(limit = 8) {
  const entries = await db('revisions')
    .select('day_number', 'journal_entry', 'mood', 'action_size')
    .orderBy('id', 'desc')
    .limit(limit);

  if (entries.length === 0) return null;

  return entries
    .reverse()
    .map(e => `DAG ${e.day_number} [${e.mood || '?'}, ${e.action_size || '?'}]: ${e.journal_entry}`)
    .join('\n');
}

async function getCycleNumber(dayNumber) {
  const [{ count }] = await db('revisions')
    .where('day_number', dayNumber)
    .count('* as count');
  return parseInt(count) + 1;
}

async function updateAppState(dayNumber) {
  await db('app_state').where('key', 'current_day').update({ value: String(dayNumber), updated_at: db.fn.now() });
  await db.raw(`UPDATE app_state SET value = (value::int + 1)::text, updated_at = NOW() WHERE key = 'total_cycles'`);
}

async function saveErrorRevision(dayNumber, cycleNumber, logs, journalEntry) {
  const revision = await db('revisions').insert({
    day_number: dayNumber,
    cycle_number: cycleNumber,
    mood: 'error',
    action_size: 'none',
    journal_entry: journalEntry,
  }).returning('id');

  const revId = revision[0].id || revision[0];
  for (const log of logs) {
    await db('cycle_logs').insert({ revision_id: revId, ...log });
  }

  await updateAppState(dayNumber);
  console.log(`[cycle] Error cycle saved, state updated.`);
}

function parseResponse(text) {
  let cleaned = text.trim();

  // Strip markdown code blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  }

  // Find JSON object boundaries if there's text around it
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

async function runCycle() {
  const dayNumber = await getDayNumber();
  const cycleNumber = await getCycleNumber(dayNumber);

  console.log(`[cycle] Starting cycle — Day ${dayNumber}, Cycle ${cycleNumber}`);

  const current = await getCurrentContent();
  const recentJournal = await getRecentJournal();
  const budget = await getBudgetInfo();

  console.log(`[cycle] Budget: ${budget.percent}% used (${budget.used}/${budget.budget} tokens), energy: ${budget.energyLevel}`);

  const { system, user } = buildPrompt({
    dayNumber,
    currentHtml: current.html,
    currentCss: current.css,
    currentJs: current.js,
    recentJournal,
    energyLevel: budget.energyLevel,
    budgetPercent: budget.percent,
  });

  let result;
  const logs = [];

  // Step 1: Call Claude
  let response;
  try {
    response = await callClaude(system, user);
    logs.push({
      step_number: 1,
      prompt_sent: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
      response_raw: response.content,
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
      duration_ms: response.durationMs,
    });
  } catch (err) {
    console.error('[cycle] Claude API call failed:', err.message);
    logs.push({
      step_number: 1,
      prompt_sent: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
      response_raw: null,
      error: err.message,
    });
    await saveErrorRevision(dayNumber, cycleNumber, logs, 'Something broke. Screen just... flickered.');
    return;
  }

  // Step 2: Parse — with truncation handling and repair retry
  if (response.stopReason === 'max_tokens') {
    // Response was truncated — ask for shorter version
    console.warn('[cycle] Response truncated — requesting shorter version');
    logs[logs.length - 1].error = 'Truncated (max_tokens)';
    result = await retryWithPrompt(
      system,
      'Your previous response was too long and got cut off. Please try again with SHORTER code. Simplify your HTML/CSS/JS — fewer elements, less code. Keep it minimal but complete. Respond with ONLY the valid JSON object.',
      logs
    );
  } else {
    // Try parsing, repair if needed
    try {
      result = parseResponse(response.content);
    } catch (parseErr) {
      console.warn('[cycle] Parse failed, attempting repair:', parseErr.message);
      logs[logs.length - 1].error = 'Parse error: ' + parseErr.message;
      result = await retryWithPrompt(
        system,
        `Your previous response could not be parsed as JSON.\n\nError: ${parseErr.message}\n\nHere is what you wrote (first 2000 chars):\n${response.content.substring(0, 2000)}\n\nPlease respond with ONLY the valid JSON object. No markdown, no explanation. Just the JSON with keys: mood, action_size, journal, html, css, js.`,
        logs
      );
    }
  }

  if (!result) {
    await saveErrorRevision(dayNumber, cycleNumber, logs, 'Brain spit out something unreadable. Trying again next time.');
    return;
  }

  // Step 3: Multi-step for large actions (skip if energy is exhausted)
  if (result.action_size === 'large' && budget.energyLevel !== 'exhausted') {
    console.log('[cycle] Large action — entering multi-step mode');
    for (let step = 2; step <= MAX_LARGE_STEPS; step++) {
      try {
        const { user: followUp } = buildFollowUpPrompt({
          dayNumber,
          previousStepResponse: JSON.stringify(result),
        });

        const stepResponse = await callClaude(system, followUp);
        logs.push({
          step_number: step,
          prompt_sent: followUp,
          response_raw: stepResponse.content,
          tokens_used: stepResponse.usage.input_tokens + stepResponse.usage.output_tokens,
          duration_ms: stepResponse.durationMs,
        });

        if (stepResponse.stopReason === 'max_tokens') {
          console.warn(`[cycle] Multi-step ${step} truncated, stopping`);
          logs[logs.length - 1].error = 'Truncated (max_tokens)';
          break;
        }

        const stepResult = parseResponse(stepResponse.content);
        if (stepResult.html) result.html = stepResult.html;
        if (stepResult.css) result.css = stepResult.css;
        if (stepResult.js) result.js = stepResult.js;
        if (stepResult.journal) result.journal = stepResult.journal;
        if (stepResult.mood) result.mood = stepResult.mood;
      } catch (err) {
        console.error(`[cycle] Multi-step ${step} failed:`, err.message);
        logs.push({ step_number: step, error: err.message });
        break;
      }
    }
  }

  // Step 4: Save revision
  const revision = await db('revisions').insert({
    day_number: dayNumber,
    cycle_number: cycleNumber,
    mood: result.mood || 'unknown',
    action_size: result.action_size || 'none',
    html: result.html || null,
    css: result.css || null,
    js: result.js || null,
    journal_entry: result.journal || 'No comment.',
  }).returning('*');

  const rev = revision[0];
  console.log(`[cycle] Saved revision #${rev.id} — mood: ${rev.mood}, action: ${rev.action_size}`);

  for (const log of logs) {
    await db('cycle_logs').insert({ revision_id: rev.id, ...log });
  }

  // Notify connected clients (metadata only — pg_notify has 8KB limit)
  try {
    const payload = JSON.stringify({
      id: rev.id,
      day_number: rev.day_number,
      cycle_number: rev.cycle_number,
      mood: rev.mood,
      action_size: rev.action_size,
      journal_entry: rev.journal_entry,
      created_at: rev.created_at,
    });
    await db.raw("SELECT pg_notify('new_revision', ?)", [payload]);
  } catch (notifyErr) {
    console.warn('[cycle] pg_notify failed (non-fatal):', notifyErr.message);
  }
  console.log(`[cycle] Notified new_revision`);

  await updateAppState(dayNumber);
  console.log(`[cycle] Cycle complete.`);
}

/**
 * Retry a failed response by sending a new prompt to Claude.
 * Returns parsed result or null if retry also fails.
 */
async function retryWithPrompt(system, retryPrompt, logs) {
  try {
    const retryResponse = await callClaude(system, retryPrompt);
    logs.push({
      step_number: 1,
      prompt_sent: retryPrompt,
      response_raw: retryResponse.content,
      tokens_used: retryResponse.usage.input_tokens + retryResponse.usage.output_tokens,
      duration_ms: retryResponse.durationMs,
    });

    if (retryResponse.stopReason === 'max_tokens') {
      console.error('[cycle] Retry also truncated');
      logs[logs.length - 1].error = 'Still truncated after retry';
      return null;
    }

    const result = parseResponse(retryResponse.content);
    console.log('[cycle] Retry succeeded');
    return result;
  } catch (err) {
    console.error('[cycle] Retry failed:', err.message);
    logs.push({ step_number: 1, error: 'Retry failed: ' + err.message });
    return null;
  }
}

module.exports = { runCycle, getDayNumber };
