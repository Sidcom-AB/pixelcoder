const express = require('express');
const router = express.Router();
const db = require('../../shared/db');

async function getRevisionHtml(revision) {
  if (!revision) return null;

  if (!revision.html) {
    const withHtml = await db('revisions').whereNotNull('html').where('id', '<=', revision.id).orderBy('id', 'desc').first();
    if (withHtml) {
      revision.html = withHtml.html;
      revision.css = withHtml.css;
      revision.js = withHtml.js;
    }
  }

  const html = revision.html || '';
  const css = revision.css || '';
  const js = revision.js || '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>
${html}
<script>${js}</script>
</body>
</html>`;
}

router.get('/latest', async (req, res) => {
  try {
    const latest = await db('revisions').orderBy('id', 'desc').first();
    const doc = await getRevisionHtml(latest);
    if (!doc) return res.status(404).send('No revision yet');
    res.type('html').send(doc);
  } catch (err) {
    console.error('[render] GET /render/latest error:', err);
    res.status(500).send('Internal server error');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const revision = await db('revisions').where('id', parseInt(req.params.id)).first();
    if (!revision) return res.status(404).send('Revision not found');
    const doc = await getRevisionHtml(revision);
    if (!doc) return res.status(404).send('No content');
    res.type('html').send(doc);
  } catch (err) {
    console.error('[render] GET /render/:id error:', err);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
