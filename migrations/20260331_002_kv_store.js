exports.up = async function (knex) {
  await knex.schema.createTable('kv_store', (t) => {
    t.string('key', 200).primary();
    t.text('value').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('kv_store');
};
