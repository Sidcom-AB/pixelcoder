require('dotenv').config();
const cron = require('node-cron');
const db = require('../shared/db');
const { runCycle } = require('./cycle');

const INTERVAL_HOURS = parseInt(process.env.CYCLE_INTERVAL_HOURS || '3');
const RETAIN_DAYS = parseInt(process.env.CYCLE_LOGS_RETAIN_DAYS || '90');

const cronExpression = `0 */${INTERVAL_HOURS} * * *`;

async function cleanupOldLogs() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETAIN_DAYS);

    const deleted = await db('cycle_logs')
      .where('created_at', '<', cutoff)
      .del();

    if (deleted > 0) {
      console.log(`[worker] Cleaned up ${deleted} old cycle logs`);
    }
  } catch (err) {
    console.error('[worker] Log cleanup failed:', err.message);
  }
}

async function checkManualTrigger() {
  try {
    const trigger = await db('app_state').where('key', 'trigger_cycle').first();
    if (trigger && trigger.value === 'true') {
      await db('app_state').where('key', 'trigger_cycle').del();
      console.log('[worker] Manual trigger detected!');
      return true;
    }
  } catch {
    // Key might not exist
  }
  return false;
}

async function main() {
  console.log(`[worker] PixelCoder worker starting`);
  console.log(`[worker] Cycle interval: every ${INTERVAL_HOURS} hours (${cronExpression})`);
  console.log(`[worker] Log retention: ${RETAIN_DAYS} days`);

  try {
    await db.raw('SELECT 1');
    console.log('[worker] Database connected');
  } catch (err) {
    console.error('[worker] Database connection failed:', err.message);
    process.exit(1);
  }

  cron.schedule(cronExpression, async () => {
    console.log(`[worker] Cron triggered at ${new Date().toISOString()}`);
    try {
      await runCycle();
    } catch (err) {
      console.error('[worker] Cycle failed:', err);
    }
  });

  setInterval(async () => {
    const triggered = await checkManualTrigger();
    if (triggered) {
      try {
        await runCycle();
      } catch (err) {
        console.error('[worker] Manual cycle failed:', err);
      }
    }
  }, 30000);

  cron.schedule('0 4 * * *', cleanupOldLogs);

  console.log('[worker] Ready. Waiting for next cycle...');
}

main();
