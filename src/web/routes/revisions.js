const express = require('express');
const router = express.Router();
const db = require('../../shared/db');

router.get('/latest', async (req, res) => {
  try {
    const latest = await db('revisions').orderBy('id', 'desc').first();
    if (!latest) return res.json({ success: true, data: null });

    if (!latest.html) {
      const withHtml = await db('revisions').whereNotNull('html').orderBy('id', 'desc').first();
      if (withHtml) {
        latest.html = withHtml.html;
        latest.css = withHtml.css;
        latest.js = withHtml.js;
      }
    }

    res.json({ success: true, data: latest });
  } catch (err) {
    console.error('[api] GET /revisions/latest error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/calendar', async (req, res) => {
  try {
    const rows = await db('revisions')
      .select('day_number')
      .count('* as count')
      .select(db.raw("array_agg(distinct mood) as moods"))
      .groupBy('day_number')
      .orderBy('day_number', 'asc');

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[api] GET /revisions/calendar error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/day/:day', async (req, res) => {
  try {
    const revisions = await db('revisions')
      .where('day_number', parseInt(req.params.day))
      .orderBy('cycle_number', 'asc');

    res.json({ success: true, data: revisions });
  } catch (err) {
    console.error('[api] GET /revisions/day error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const revision = await db('revisions').where('id', parseInt(req.params.id)).first();
    if (!revision) return res.status(404).json({ success: false, error: 'Revision not found' });

    if (!revision.html) {
      const withHtml = await db('revisions').whereNotNull('html').where('id', '<', revision.id).orderBy('id', 'desc').first();
      if (withHtml) {
        revision.html = withHtml.html;
        revision.css = withHtml.css;
        revision.js = withHtml.js;
      }
    }

    res.json({ success: true, data: revision });
  } catch (err) {
    console.error('[api] GET /revisions/:id error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
