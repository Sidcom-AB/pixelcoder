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
        start_date: state.start_date || '2026-04-01',
        cycle_interval_hours: parseInt(state.cycle_interval_hours || '3'),
        last_revision: lastRevision ? {
          id: lastRevision.id,
          day_number: lastRevision.day_number,
          cycle_number: lastRevision.cycle_number,
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
    const search = req.query.search || '';
    const errorsOnly = req.query.errors_only === 'true';

    let query = db('cycle_logs');
    let countQuery = db('cycle_logs');

    if (search) {
      const filter = builder => {
        builder.where('prompt_sent', 'ilike', `%${search}%`)
               .orWhere('response_raw', 'ilike', `%${search}%`);
      };
      query = query.where(filter);
      countQuery = countQuery.where(filter);
    }

    if (errorsOnly) {
      query = query.whereNotNull('error').where('error', '!=', '');
      countQuery = countQuery.whereNotNull('error').where('error', '!=', '');
    }

    const logs = await query.orderBy('id', 'desc').limit(limit).offset(offset);
    const [{ count }] = await countQuery.count('* as count');

    res.json({ success: true, data: logs, meta: { page, limit, total: parseInt(count) } });
  } catch (err) {
    console.error('[api] GET /cycle/logs error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/revisions', requireSecret, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const revisions = await db('revisions').orderBy('id', 'desc').limit(limit).offset(offset);
    const [{ count }] = await db('revisions').count('* as count');

    res.json({ success: true, data: revisions, meta: { page, limit, total: parseInt(count) } });
  } catch (err) {
    console.error('[api] GET /cycle/revisions error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/app-state', requireSecret, async (req, res) => {
  try {
    const rows = await db('app_state').select('*').orderBy('key');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[api] GET /cycle/app-state error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/token-usage', requireSecret, async (req, res) => {
  try {
    const usage = await db('cycle_logs')
      .select(db.raw("to_char(created_at AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD') as date"))
      .sum('tokens_used as tokens')
      .count('* as cycles')
      .groupByRaw("to_char(created_at AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD')")
      .orderBy('date', 'desc')
      .limit(30);

    const totalRow = await db('cycle_logs').sum('tokens_used as total').first();

    res.json({
      success: true,
      data: { daily: usage, total_tokens: parseInt(totalRow?.total || '0') }
    });
  } catch (err) {
    console.error('[api] GET /cycle/token-usage error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/refuel', requireSecret, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ total }] = await db('cycle_logs')
      .where('created_at', '>=', todayStart)
      .sum('tokens_used as total');

    const usedToday = parseInt(total) || 0;
    if (usedToday <= 0) {
      return res.json({ success: true, message: 'Budget already full, nothing to refuel.' });
    }

    // Credit back 70% of today's usage
    const credit = -Math.round(usedToday * 0.7);

    await db('cycle_logs').insert({
      revision_id: null,
      step_number: 0,
      prompt_sent: null,
      response_raw: 'Budget refuel (admin)',
      tokens_used: credit,
      duration_ms: 0,
      error: null,
    });

    res.json({ success: true, message: `Refueled ${(-credit).toLocaleString()} tokens.` });
  } catch (err) {
    console.error('[api] POST /cycle/refuel error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/logs', requireSecret, async (req, res) => {
  try {
    const days = Math.max(1, parseInt(req.query.older_than_days) || 90);
    const deleted = await db('cycle_logs')
      .where('created_at', '<', db.raw(`NOW() - make_interval(days => ?)`, [days]))
      .del();

    res.json({ success: true, deleted });
  } catch (err) {
    console.error('[api] DELETE /cycle/logs error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/revisions/:id', requireSecret, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid revision ID' });

    const deleted = await db('revisions').where('id', id).del();
    if (!deleted) return res.status(404).json({ success: false, error: 'Revision not found' });

    res.json({ success: true, deleted: id });
  } catch (err) {
    console.error('[api] DELETE /cycle/revisions/:id error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/revisions/:id/journal', requireSecret, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { journal_entry } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'Invalid revision ID' });
    if (journal_entry == null) return res.status(400).json({ success: false, error: 'journal_entry required' });

    const updated = await db('revisions').where('id', id).update({ journal_entry });
    if (!updated) return res.status(404).json({ success: false, error: 'Revision not found' });

    res.json({ success: true, id });
  } catch (err) {
    console.error('[api] PUT /cycle/revisions/:id/journal error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const EDITABLE_SETTINGS = ['cycle_interval_hours', 'start_date', 'cycle_logs_retain_days', 'daily_token_budget', 'claude_model'];

router.put('/settings', requireSecret, async (req, res) => {
  try {
    const updates = req.body;
    const changed = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!EDITABLE_SETTINGS.includes(key)) continue;

      const exists = await db('app_state').where('key', key).first();
      if (exists) {
        await db('app_state').where('key', key).update({ value: String(value), updated_at: db.fn.now() });
      } else {
        await db('app_state').insert({ key, value: String(value), updated_at: db.fn.now() });
      }
      changed.push(key);
    }

    res.json({ success: true, changed });
  } catch (err) {
    console.error('[api] PUT /cycle/settings error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
