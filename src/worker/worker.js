require('dotenv').config();
const cron = require('node-cron');
const db = require('../shared/db');
const settings = require('../shared/settings');
const { runCycle } = require('./cycle');

let cronTask = null;

async function cleanupOldLogs() {
  try {
    const retainDays = parseInt(await settings.get('cycle_logs_retain_days'));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retainDays);

    const deleted = await db('cycle_logs')
      .where('created_at', '<', cutoff)
      .del();

    if (deleted > 0) {
      console.log(`[worker] Cleaned up ${deleted} old cycle logs (retain: ${retainDays} days)`);
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

async function scheduleCron() {
  const intervalHours = parseInt(await settings.get('cycle_interval_hours'));
  const cronExpression = `0 */${intervalHours} * * *`;

  if (cronTask) {
    cronTask.stop();
  }

  cronTask = cron.schedule(cronExpression, async () => {
    console.log(`[worker] Cron triggered at ${new Date().toISOString()}`);
    try {
      await runCycle();
    } catch (err) {
      console.error('[worker] Cycle failed:', err);
    }
  });

  console.log(`[worker] Cron scheduled: every ${intervalHours}h (${cronExpression})`);
}

async function main() {
  console.log(`[worker] PixelCoder worker starting`);

  try {
    await db.raw('SELECT 1');
    console.log('[worker] Database connected');
  } catch (err) {
    console.error('[worker] Database connection failed:', err.message);
    process.exit(1);
  }

  const allSettings = await settings.getAll();
  console.log(`[worker] Settings:`, JSON.stringify(allSettings, null, 2));

  await scheduleCron();

  // Poll for manual triggers + re-read interval setting
  let lastInterval = allSettings.cycle_interval_hours;
  setInterval(async () => {
    // Check for setting changes
    try {
      const currentInterval = await settings.get('cycle_interval_hours');
      if (currentInterval !== lastInterval) {
        console.log(`[worker] Interval changed: ${lastInterval}h → ${currentInterval}h`);
        lastInterval = currentInterval;
        await scheduleCron();
      }
    } catch { /* ignore */ }

    // Write heartbeat so admin knows the worker is alive and what it's running
    try {
      await settings.set('worker_heartbeat', JSON.stringify({
        alive: true,
        interval: lastInterval,
        timestamp: new Date().toISOString(),
      }));
    } catch { /* ignore */ }

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
