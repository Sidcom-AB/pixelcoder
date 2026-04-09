const db = require('../shared/db');
const settings = require('../shared/settings');
const { callClaudeWithTools } = require('./claude');
const { toolDefinitions, executeTool } = require('./tools');
const { buildPrompt } = require('./prompts');

async function getTodayTokenUsage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ total }] = await db('cycle_logs')
    .where('created_at', '>=', todayStart)
    .sum('tokens_used as total');

  return parseInt(total) || 0;
}

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

async function getWorkspaceManifest() {
  return db('workspace_files')
    .select(
      'filename',
      db.raw("length(content) as chars"),
      db.raw("array_length(string_to_array(content, E'\\n'), 1) as lines")
    )
    .orderBy('filename');
}

async function getRecentJournal(limit = 8) {
  const entries = await db('revisions')
    .select('day_number', 'journal_entry', 'mood', 'action_size')
    .orderBy('id', 'desc')
    .limit(limit);

  if (entries.length === 0) return null;

  return entries
    .reverse()
    .map(e => `DAY ${e.day_number} [${e.mood || '?'}, ${e.action_size || '?'}]: ${e.journal_entry}`)
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

async function snapshotWorkspace(revisionId) {
  await db.raw(`
    INSERT INTO revision_files (revision_id, filename, content)
    SELECT ?, filename, content FROM workspace_files
  `, [revisionId]);
}

function parseResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

async function shouldSkipCycle(budget) {
  if (budget.energyLevel !== 'exhausted') return false;

  // Check if the last 2 revisions were already "rest" cycles (action_size: none)
  // If so, skip — we don't need a third "I'm tired" post in a row
  const recent = await db('revisions')
    .select('action_size')
    .orderBy('id', 'desc')
    .limit(2);

  const allResting = recent.length >= 2 && recent.every(r => r.action_size === 'none');
  return allResting;
}

async function runCycle() {
  const dayNumber = await getDayNumber();
  const cycleNumber = await getCycleNumber(dayNumber);

  console.log(`[cycle] Starting cycle — Day ${dayNumber}, Cycle ${cycleNumber}`);

  const fileManifest = await getWorkspaceManifest();
  const recentJournal = await getRecentJournal();
  const budget = await getBudgetInfo();

  console.log(`[cycle] Budget: ${budget.percent}% used (${budget.used}/${budget.budget} tokens), energy: ${budget.energyLevel}`);
  console.log(`[cycle] Workspace: ${fileManifest.length} files`);

  // Skip cycle if exhausted and already posted multiple rest entries
  if (await shouldSkipCycle(budget)) {
    console.log(`[cycle] Skipping — exhausted and last 2 cycles were rest. Saving tokens.`);
    await updateAppState(dayNumber);
    return;
  }

  // Create revision FIRST so we have an ID to log against immediately
  const revision = await db('revisions').insert({
    day_number: dayNumber,
    cycle_number: cycleNumber,
    mood: 'in_progress',
    action_size: 'none',
    journal_entry: 'Cycle in progress...',
    uses_filesystem: true,
  }).returning('*');

  const rev = revision[0];
  console.log(`[cycle] Created revision #${rev.id} (in_progress)`);

  const { system, user } = buildPrompt({
    dayNumber,
    fileManifest,
    recentJournal,
    energyLevel: budget.energyLevel,
    budgetPercent: budget.percent,
  });

  // Log each turn to DB immediately as it happens
  const onTurn = async (logEntry) => {
    await db('cycle_logs').insert({ revision_id: rev.id, ...logEntry });
  };

  // Run the tool-use conversation
  let response;
  try {
    response = await callClaudeWithTools(system, user, toolDefinitions, executeTool, { onTurn });
  } catch (err) {
    console.error('[cycle] Claude conversation failed:', err.message);
    await db('cycle_logs').insert({ revision_id: rev.id, step_number: 0, error: err.message });
    await db('revisions').where('id', rev.id).update({
      mood: 'error',
      journal_entry: 'Something broke. Screen just... flickered.',
    });
    await updateAppState(dayNumber);
    return;
  }

  console.log(`[cycle] Conversation done — ${response.totalTokens} tokens`);

  // Parse the final text response (mood + journal JSON)
  let result;
  try {
    result = parseResponse(response.text);
  } catch (err) {
    console.error('[cycle] Failed to parse final response:', err.message);
    console.error('[cycle] Raw text:', response.text?.substring(0, 500));
    await db('cycle_logs').insert({ revision_id: rev.id, step_number: 0, error: 'Parse error: ' + err.message });
    await db('revisions').where('id', rev.id).update({
      mood: 'error',
      journal_entry: 'Brain spit out something unreadable. Trying again next time.',
    });
    await updateAppState(dayNumber);
    return;
  }

  // Update revision with final result
  await db('revisions').where('id', rev.id).update({
    mood: result.mood || 'unknown',
    action_size: result.action_size || 'none',
    journal_entry: result.journal || 'No comment.',
  });

  console.log(`[cycle] Updated revision #${rev.id} — mood: ${result.mood}, action: ${result.action_size}`);

  // Snapshot workspace files
  await snapshotWorkspace(rev.id);
  const snapCount = await db('revision_files').where('revision_id', rev.id).count('* as count').first();
  console.log(`[cycle] Snapshotted ${snapCount.count} files`);

  // Notify connected clients
  try {
    const payload = JSON.stringify({
      id: rev.id,
      day_number: dayNumber,
      cycle_number: cycleNumber,
      mood: result.mood,
      action_size: result.action_size,
      journal_entry: result.journal,
      created_at: rev.created_at,
    });
    await db.raw("SELECT pg_notify('new_revision', ?)", [payload]);
  } catch (notifyErr) {
    console.warn('[cycle] pg_notify failed (non-fatal):', notifyErr.message);
  }

  await updateAppState(dayNumber);
  console.log(`[cycle] Cycle complete.`);
}

module.exports = { runCycle, getDayNumber };
