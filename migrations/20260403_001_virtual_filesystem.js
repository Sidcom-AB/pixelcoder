exports.up = async function (knex) {
  // Workspace: living state of the character's files
  await knex.schema.createTable('workspace_files', (t) => {
    t.string('filename', 255).primary();
    t.text('content').notNullable();
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Revision snapshots: copy of all files at revision time
  await knex.schema.createTable('revision_files', (t) => {
    t.increments('id').primary();
    t.integer('revision_id').notNullable().references('id').inTable('revisions').onDelete('CASCADE');
    t.string('filename', 255).notNullable();
    t.text('content').notNullable();
    t.unique(['revision_id', 'filename']);
  });

  // Flag to distinguish new filesystem revisions from legacy blob revisions
  await knex.schema.alterTable('revisions', (t) => {
    t.boolean('uses_filesystem').defaultTo(false);
  });

  // Seed workspace from latest revision with content
  const latest = await knex('revisions').whereNotNull('html').orderBy('id', 'desc').first();
  if (latest) {
    const files = [];
    if (latest.html) files.push({ filename: 'index.html', content: latest.html });
    if (latest.css) files.push({ filename: 'style.css', content: latest.css });
    if (latest.js) files.push({ filename: 'app.js', content: latest.js });
    for (const f of files) {
      await knex('workspace_files').insert(f);
    }
    console.log(`[migration] Seeded workspace with ${files.length} files from revision #${latest.id}`);
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('revision_files');
  await knex.schema.dropTableIfExists('workspace_files');
  await knex.schema.alterTable('revisions', (t) => {
    t.dropColumn('uses_filesystem');
  });
};
