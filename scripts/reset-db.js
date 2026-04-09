#!/usr/bin/env node
/**
 * Reset database: rollback all migrations, re-run them, seed fresh.
 * Usage: node scripts/reset-db.js
 */
require('dotenv').config();
const db = require('../src/shared/db');

async function reset() {
  console.log('Resetting database...\n');

  // Truncate all data tables (faster than rollback+migrate for just wiping data)
  console.log('  Clearing cycle_logs...');
  await db('cycle_logs').del();

  console.log('  Clearing revisions...');
  await db('revisions').del();

  console.log('  Clearing kv_store...');
  await db('kv_store').del();

  // Reset app_state to defaults
  console.log('  Resetting app_state...');
  await db('app_state').del();
  await db('app_state').insert([
    { key: 'current_day', value: '0' },
    { key: 'total_cycles', value: '0' },
    { key: 'cycle_interval_hours', value: '3' },
    { key: 'start_date', value: '2026-04-01' },
    { key: 'cycle_logs_retain_days', value: '90' },
    { key: 'daily_token_budget', value: '300000' },
  ]);

  // Reset auto-increment sequences
  console.log('  Resetting sequences...');
  await db.raw("ALTER SEQUENCE revisions_id_seq RESTART WITH 1");
  await db.raw("ALTER SEQUENCE cycle_logs_id_seq RESTART WITH 1");

  console.log('\nDone. Fresh start.');
  await db.destroy();
}

reset().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
