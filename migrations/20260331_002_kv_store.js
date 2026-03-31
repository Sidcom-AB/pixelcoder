exports.up = async function (knex) {
  // Key-value store for the AI character to persist data between cycles.
  // Separate from app_state which is for internal system state.
  await knex.schema.createTable('kv_store', (t) => {
    t.string('key', 200).primary();
    t.text('value').notNullable();
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Seed visitor counter
  await knex('app_state').insert({ key: 'visitor_count', value: '0' });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('kv_store');
  await knex('app_state').where('key', 'visitor_count').del();
};
