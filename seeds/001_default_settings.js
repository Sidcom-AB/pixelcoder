const DEFAULTS = [
  { key: 'current_day', value: '0' },
  { key: 'total_cycles', value: '0' },
  { key: 'cycle_interval_hours', value: '3' },
  { key: 'start_date', value: '2026-04-01' },
  { key: 'cycle_logs_retain_days', value: '90' },
  { key: 'daily_token_budget', value: '120000' },
  { key: 'claude_model', value: 'claude-opus-4-6' },
];

exports.seed = async function (knex) {
  for (const { key, value } of DEFAULTS) {
    const exists = await knex('app_state').where('key', key).first();
    if (!exists) {
      await knex('app_state').insert({ key, value });
    }
  }
};
