#!/usr/bin/env node
/**
 * Debug script: dumps recent database state to stdout.
 * Usage: node scripts/db-dump.js [--full]
 */
require('dotenv').config();
const db = require('../src/shared/db');

async function dump() {
  const full = process.argv.includes('--full');

  console.log('='.repeat(80));
  console.log('  DB DUMP — ' + new Date().toISOString());
  console.log('='.repeat(80));

  // App state
  const state = await db('app_state').select('*');
  console.log('\n── APP_STATE ──');
  state.forEach(r => console.log(`  ${r.key} = ${r.value} (updated: ${r.updated_at})`));

  // Revisions
  const revisions = full
    ? await db('revisions').orderBy('id', 'desc')
    : await db('revisions').orderBy('id', 'desc').limit(10);
  console.log(`\n── REVISIONS (${revisions.length} shown) ──`);
  revisions.forEach(r => {
    console.log(`\n  #${r.id} | Day ${r.day_number} Cycle ${r.cycle_number} | mood: ${r.mood} | action: ${r.action_size} | ${r.created_at}`);
    console.log(`  journal: ${r.journal_entry}`);
    console.log(`  html: ${r.html ? r.html.length + ' chars' : 'NULL'}`);
    console.log(`  css:  ${r.css ? r.css.length + ' chars' : 'NULL'}`);
    console.log(`  js:   ${r.js ? r.js.length + ' chars' : 'NULL'}`);
  });

  // Cycle logs
  const logs = full
    ? await db('cycle_logs').orderBy('id', 'desc')
    : await db('cycle_logs').orderBy('id', 'desc').limit(20);
  console.log(`\n── CYCLE_LOGS (${logs.length} shown) ──`);
  logs.forEach(l => {
    console.log(`\n  #${l.id} | rev_id: ${l.revision_id} | step: ${l.step_number} | tokens: ${l.tokens_used || '-'} | ${l.duration_ms || '-'}ms | ${l.created_at}`);
    if (l.error) {
      console.log(`  ERROR: ${l.error}`);
    }
    if (l.response_raw) {
      const preview = l.response_raw.substring(0, 500);
      console.log(`  response (first 500): ${preview}${l.response_raw.length > 500 ? '...' : ''}`);
    }
    if (l.prompt_sent && full) {
      const preview = l.prompt_sent.substring(0, 300);
      console.log(`  prompt (first 300): ${preview}${l.prompt_sent.length > 300 ? '...' : ''}`);
    }
  });

  // KV store
  try {
    const kv = await db('kv_store').select('*');
    if (kv.length > 0) {
      console.log(`\n── KV_STORE (${kv.length} rows) ──`);
      kv.forEach(r => {
        const val = r.value ? (r.value.length > 200 ? r.value.substring(0, 200) + '...' : r.value) : 'NULL';
        console.log(`  ${r.key} = ${val}`);
      });
    }
  } catch (e) {
    // kv_store may not exist
  }

  console.log('\n' + '='.repeat(80));
  await db.destroy();
}

dump().catch(err => {
  console.error('Dump failed:', err);
  process.exit(1);
});
