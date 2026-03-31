const express = require('express');
const router = express.Router();
const db = require('../../shared/db');

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
    const offset = (page - 1) * limit;

    const entries = await db('revisions')
      .select('id', 'day_number', 'cycle_number', 'mood', 'action_size', 'journal_entry', 'created_at')
      .orderBy('id', 'desc')
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db('revisions').count('* as count');

    res.json({
      success: true,
      data: entries,
      meta: { page, limit, total: parseInt(count), has_more: offset + entries.length < parseInt(count) },
    });
  } catch (err) {
    console.error('[api] GET /journal error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/day/:day', async (req, res) => {
  try {
    const entries = await db('revisions')
      .select('id', 'day_number', 'cycle_number', 'mood', 'action_size', 'journal_entry', 'created_at')
      .where('day_number', parseInt(req.params.day))
      .orderBy('cycle_number', 'asc');

    res.json({ success: true, data: entries });
  } catch (err) {
    console.error('[api] GET /journal/day error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
