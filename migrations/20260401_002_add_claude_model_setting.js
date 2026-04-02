exports.up = async function (knex) {
  const exists = await knex('app_state').where('key', 'claude_model').first();
  if (!exists) {
    await knex('app_state').insert({ key: 'claude_model', value: 'claude-opus-4-6' });
  }
};

exports.down = async function (knex) {
  await knex('app_state').where('key', 'claude_model').del();
};
