const express = require('express');
const router = express.Router();
const db = require('../../shared/db');

function requireSecret(req, res, next) {
  const secret = process.env.API_SECRET;
  if (!secret) return res.status(500).json({ success: false, error: 'API_SECRET not configured' });

  const provided = req.headers['x-api-secret'] || req.query.secret;
  if (provided !== secret) return res.status(401).json({ success: false, error: 'Unauthorized' });
  next();
}

router.post('/trigger', requireSecret, async (req, res) => {
  try {
    await db('app_state').where('key', 'trigger_cycle').del();
    await db('app_state').insert({ key: 'trigger_cycle', value: 'true' });
    res.json({ success: true, message: 'Cycle triggered. Worker will pick it up.' });
  } catch (err) {
    console.error('[api] POST /cycle/trigger error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const stateRows = await db('app_state').select('*');
    const state = {};
    stateRows.forEach(r => { state[r.key] = r.value; });

    const lastRevision = await db('revisions').orderBy('id', 'desc').first();

    res.json({
      success: true,
      data: {
        current_day: parseInt(state.current_day || '0'),
        total_cycles: parseInt(state.total_cycles || '0'),
        start_date: process.env.START_DATE || '2026-04-01',
        cycle_interval_hours: parseInt(process.env.CYCLE_INTERVAL_HOURS || '3'),
        last_revision: lastRevision ? {
          id: lastRevision.id,
          day_number: lastRevision.day_number,
          mood: lastRevision.mood,
          action_size: lastRevision.action_size,
          created_at: lastRevision.created_at,
        } : null,
      },
    });
  } catch (err) {
    console.error('[api] GET /cycle/status error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/logs', requireSecret, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const logs = await db('cycle_logs').orderBy('id', 'desc').limit(limit).offset(offset);
    const [{ count }] = await db('cycle_logs').count('* as count');

    res.json({ success: true, data: logs, meta: { page, limit, total: parseInt(count) } });
  } catch (err) {
    console.error('[api] GET /cycle/logs error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
