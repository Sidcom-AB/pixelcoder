const SETTINGS = [
  { key: 'cycle_interval_hours', value: '3' },
  { key: 'start_date', value: '2026-04-01' },
  { key: 'cycle_logs_retain_days', value: '90' },
  { key: 'daily_token_budget', value: '120000' },
];

exports.up = async function (knex) {
  for (const s of SETTINGS) {
    const exists = await knex('app_state').where('key', s.key).first();
    if (!exists) {
      await knex('app_state').insert(s);
    }
  }
};

exports.down = async function (knex) {
  await knex('app_state').whereIn('key', SETTINGS.map(s => s.key)).del();
};
