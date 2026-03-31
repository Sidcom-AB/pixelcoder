const express = require('express');
const router = express.Router();
const db = require('../../shared/db');

const MAX_VALUE_SIZE = 2048; // 2KB
const MAX_PREFIX_ROWS = 500;
const MAX_QUERY_RESULTS = 100;

// Simple in-memory rate limiter (per IP, resets hourly)
const hits = new Map();
const RATE_LIMIT = parseInt(process.env.STORE_RATE_LIMIT || '20');

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour

  let entry = hits.get(ip);
  if (!entry || now - entry.start > window) {
    entry = { start: now, count: 0 };
    hits.set(ip, entry);
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded. Try again later.' });
  }
  next();
}

// Cleanup old rate limit entries every 10 min
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [ip, entry] of hits) {
    if (entry.start < cutoff) hits.delete(ip);
  }
}, 10 * 60 * 1000);

// GET /api/store/:key — read single key
router.get('/:key', async (req, res) => {
  try {
    const row = await db('kv_store').where('key', req.params.key).first();
    if (!row) return res.status(404).json({ success: false, error: 'Key not found' });

    // Try to parse value as JSON, fall back to string
    let value = row.value;
    try { value = JSON.parse(value); } catch {}

    res.json({ success: true, data: { key: row.key, value, updated_at: row.updated_at } });
  } catch (err) {
    console.error('[store] GET error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/store?prefix=gb: — list by prefix
router.get('/', async (req, res) => {
  try {
    const prefix = req.query.prefix;
    if (!prefix) return res.status(400).json({ success: false, error: 'prefix query param required' });

    const rows = await db('kv_store')
      .where('key', 'like', `${prefix}%`)
      .orderBy('created_at', 'desc')
      .limit(MAX_QUERY_RESULTS);

    const data = rows.map(r => {
      let value = r.value;
      try { value = JSON.parse(value); } catch {}
      return { key: r.key, value, updated_at: r.updated_at };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('[store] GET list error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/store — create entry
router.post('/', rateLimit, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, error: 'key and value required' });
    }
    if (key.length > 200) {
      return res.status(400).json({ success: false, error: 'Key too long (max 200 chars)' });
    }

    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    if (valueStr.length > MAX_VALUE_SIZE) {
      return res.status(400).json({ success: false, error: `Value too large (max ${MAX_VALUE_SIZE} bytes)` });
    }

    // Check prefix row limit
    const prefix = key.includes(':') ? key.split(':')[0] + ':' : key;
    const [{ count }] = await db('kv_store')
      .where('key', 'like', `${prefix}%`)
      .count('* as count');

    if (parseInt(count) >= MAX_PREFIX_ROWS) {
      return res.status(400).json({ success: false, error: `Too many entries for prefix "${prefix}" (max ${MAX_PREFIX_ROWS})` });
    }

    // Upsert
    const exists = await db('kv_store').where('key', key).first();
    if (exists) {
      await db('kv_store').where('key', key).update({ value: valueStr, updated_at: db.fn.now() });
    } else {
      await db('kv_store').insert({ key, value: valueStr });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[store] POST error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/store/:key — update entry
router.put('/:key', rateLimit, async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'value required' });
    }

    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    if (valueStr.length > MAX_VALUE_SIZE) {
      return res.status(400).json({ success: false, error: `Value too large (max ${MAX_VALUE_SIZE} bytes)` });
    }

    const updated = await db('kv_store')
      .where('key', req.params.key)
      .update({ value: valueStr, updated_at: db.fn.now() });

    if (!updated) return res.status(404).json({ success: false, error: 'Key not found' });

    res.json({ success: true });
  } catch (err) {
    console.error('[store] PUT error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/store/:key — admin only
router.delete('/:key', async (req, res) => {
  const secret = process.env.API_SECRET;
  const provided = req.headers['x-api-secret'] || req.query.secret;
  if (!secret || provided !== secret) {
    return res.status(401).json({ success: false, error: 'Delete requires admin access' });
  }

  try {
    await db('kv_store').where('key', req.params.key).del();
    res.json({ success: true });
  } catch (err) {
    console.error('[store] DELETE error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
