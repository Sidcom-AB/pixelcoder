exports.up = async function (knex) {
  await knex.schema.createTable('revisions', (t) => {
    t.increments('id').primary();
    t.integer('day_number').notNullable();
    t.integer('cycle_number').notNullable().defaultTo(1);
    t.string('mood', 50);
    t.string('action_size', 10);
    t.text('html');
    t.text('css');
    t.text('js');
    t.text('journal_entry').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('cycle_logs', (t) => {
    t.increments('id').primary();
    t.integer('revision_id').references('id').inTable('revisions').onDelete('CASCADE');
    t.integer('step_number').notNullable();
    t.text('prompt_sent');
    t.text('response_raw');
    t.integer('tokens_used');
    t.integer('duration_ms');
    t.text('error');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('app_state', (t) => {
    t.string('key', 100).primary();
    t.text('value').notNullable();
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex('app_state').insert([
    { key: 'current_day', value: '0' },
    { key: 'total_cycles', value: '0' },
  ]);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('cycle_logs');
  await knex.schema.dropTableIfExists('revisions');
  await knex.schema.dropTableIfExists('app_state');
};
