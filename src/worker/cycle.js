const db = require('../shared/db');
const { callClaude } = require('./claude');
const { buildPrompt, buildFollowUpPrompt } = require('./prompts');

const MAX_LARGE_STEPS = 3;
const DAILY_TOKEN_BUDGET = parseInt(process.env.DAILY_TOKEN_BUDGET || '120000');

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
  const percent = Math.round((used / DAILY_TOKEN_BUDGET) * 100);
  let energyLevel;

  if (percent < 40) energyLevel = 'full';
  else if (percent < 70) energyLevel = 'good';
  else if (percent < 90) energyLevel = 'low';
  else energyLevel = 'exhausted';

  return { used, budget: DAILY_TOKEN_BUDGET, percent, energyLevel };
}

function getDayNumber() {
  const start = new Date(process.env.START_DATE || '2026-04-01');
  const now = new Date();
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

function parseResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(cleaned);
}

async function runCycle() {
  const dayNumber = getDayNumber();
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
  let logs = [];

  try {
    const response = await callClaude(system, user);
    logs.push({
      step_number: 1,
      prompt_sent: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
      response_raw: response.content,
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
      duration_ms: response.durationMs,
    });

    result = parseResponse(response.content);
  } catch (err) {
    console.error('[cycle] Claude call failed:', err.message);
    logs.push({
      step_number: 1,
      prompt_sent: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
      response_raw: null,
      error: err.message,
    });

    const revision = await db('revisions').insert({
      day_number: dayNumber,
      cycle_number: cycleNumber,
      mood: 'error',
      action_size: 'none',
      journal_entry: 'Något gick fel. Skärmen bara... blinkade.',
    }).returning('id');

    const revId = revision[0].id || revision[0];
    for (const log of logs) {
      await db('cycle_logs').insert({ revision_id: revId, ...log });
    }
    return;
  }

  // Multi-step for large actions (skip if energy is exhausted)
  if (result.action_size === 'large' && budget.energyLevel !== 'exhausted') {
    console.log('[cycle] Large action — entering multi-step mode');
    for (let step = 2; step <= MAX_LARGE_STEPS; step++) {
      try {
        const { user: followUp } = buildFollowUpPrompt({
          dayNumber,
          previousStepResponse: JSON.stringify(result),
        });

        const response = await callClaude(system, followUp);
        logs.push({
          step_number: step,
          prompt_sent: followUp,
          response_raw: response.content,
          tokens_used: response.usage.input_tokens + response.usage.output_tokens,
          duration_ms: response.durationMs,
        });

        const stepResult = parseResponse(response.content);
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

  // Save revision
  const revision = await db('revisions').insert({
    day_number: dayNumber,
    cycle_number: cycleNumber,
    mood: result.mood || 'unknown',
    action_size: result.action_size || 'none',
    html: result.html || null,
    css: result.css || null,
    js: result.js || null,
    journal_entry: result.journal || 'Ingen kommentar.',
  }).returning('*');

  const rev = revision[0];
  console.log(`[cycle] Saved revision #${rev.id} — mood: ${rev.mood}, action: ${rev.action_size}`);

  // Save cycle logs
  for (const log of logs) {
    await db('cycle_logs').insert({ revision_id: rev.id, ...log });
  }

  // Notify connected clients
  const payload = JSON.stringify({
    id: rev.id,
    day_number: rev.day_number,
    cycle_number: rev.cycle_number,
    mood: rev.mood,
    action_size: rev.action_size,
    html: rev.html,
    css: rev.css,
    js: rev.js,
    journal_entry: rev.journal_entry,
    created_at: rev.created_at,
  });

  await db.raw("SELECT pg_notify('new_revision', ?)", [payload]);
  console.log(`[cycle] Notified new_revision`);

  // Update app state
  await db('app_state').where('key', 'current_day').update({ value: String(dayNumber), updated_at: db.fn.now() });
  await db.raw(`UPDATE app_state SET value = (value::int + 1)::text, updated_at = NOW() WHERE key = 'total_cycles'`);

  console.log(`[cycle] Cycle complete.`);
}

module.exports = { runCycle, getDayNumber };
