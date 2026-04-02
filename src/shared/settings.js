const db = require('./db');

const DEFAULTS = {
  cycle_interval_hours: '3',
  start_date: '2026-04-01',
  cycle_logs_retain_days: '90',
  daily_token_budget: '120000',
  claude_model: 'claude-opus-4-6',
};

/**
 * Get a single setting by key. Returns the value string or the default.
 */
async function get(key) {
  const row = await db('app_state').where('key', key).first();
  return row?.value ?? DEFAULTS[key] ?? null;
}

/**
 * Get all settings as an object.
 */
async function getAll() {
  const rows = await db('app_state').select('*');
  const state = {};
  for (const key of Object.keys(DEFAULTS)) {
    state[key] = DEFAULTS[key];
  }
  rows.forEach(r => { state[r.key] = r.value; });
  return state;
}

/**
 * Set a single setting.
 */
async function set(key, value) {
  const exists = await db('app_state').where('key', key).first();
  if (exists) {
    await db('app_state').where('key', key).update({ value: String(value), updated_at: db.fn.now() });
  } else {
    await db('app_state').insert({ key, value: String(value), updated_at: db.fn.now() });
  }
}

module.exports = { get, getAll, set, DEFAULTS };
