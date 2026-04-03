const express = require('express');
const router = express.Router();
const db = require('../../shared/db');

/**
 * Build HTML document from a revision.
 * Supports both legacy blob-based revisions and new filesystem-based ones.
 */
async function getRevisionHtml(revision) {
  if (!revision) return null;

  // New filesystem-based revision
  if (revision.uses_filesystem) {
    const files = await db('revision_files')
      .where('revision_id', revision.id)
      .select('filename', 'content');

    if (files.length === 0) {
      // Filesystem revision with no files — try falling back to workspace
      const wsFiles = await db('workspace_files').select('filename', 'content');
      if (wsFiles.length === 0) return null;
      return assembleHtml(wsFiles);
    }

    return assembleHtml(files);
  }

  // Legacy blob-based revision
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

/**
 * Assemble a complete HTML document from a list of files.
 * Convention: index.html = body, *.css = style tags, *.js = script tags.
 */
function assembleHtml(files) {
  const fileMap = {};
  files.forEach(f => { fileMap[f.filename] = f.content; });

  const htmlContent = fileMap['index.html'] || '';
  const cssFiles = files.filter(f => f.filename.endsWith('.css')).sort((a, b) => a.filename.localeCompare(b.filename));
  const jsFiles = files.filter(f => f.filename.endsWith('.js')).sort((a, b) => a.filename.localeCompare(b.filename));

  const cssTags = cssFiles.map(f => `<style>/* ${f.filename} */\n${f.content}</style>`).join('\n');
  const jsTags = jsFiles.map(f => `<script>/* ${f.filename} */\n${f.content}</script>`).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${cssTags}
</head>
<body>
${htmlContent}
${jsTags}
</body>
</html>`;
}

/**
 * Render the latest revision — or fall back to current workspace if no revision exists.
 */
router.get('/latest', async (req, res) => {
  try {
    const latest = await db('revisions').orderBy('id', 'desc').first();

    // If latest revision uses filesystem, render from revision_files
    if (latest) {
      const doc = await getRevisionHtml(latest);
      if (doc) return res.type('html').send(doc);
    }

    // Fallback: render directly from workspace_files (before first cycle completes)
    const wsFiles = await db('workspace_files').select('filename', 'content');
    if (wsFiles.length > 0) {
      return res.type('html').send(assembleHtml(wsFiles));
    }

    res.status(404).send('No revision yet');
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
