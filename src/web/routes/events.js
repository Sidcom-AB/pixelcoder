const express = require('express');
const router = express.Router();
const { Client } = require('pg');

const clients = new Set();

async function startListening() {
  const pgClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'pixelcoder',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'pixelcoder',
  });

  await pgClient.connect();
  await pgClient.query('LISTEN new_revision');

  pgClient.on('notification', (msg) => {
    if (msg.channel === 'new_revision') {
      const payload = msg.payload;
      clients.forEach(res => {
        res.write(`event: new_revision\ndata: ${payload}\n\n`);
      });
    }
  });

  pgClient.on('error', (err) => {
    console.error('[sse] PostgreSQL listener error:', err);
    setTimeout(startListening, 5000);
  });

  console.log('[sse] Listening for new_revision notifications');
}

router.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(':ok\n\n');
  clients.add(res);

  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clients.delete(res);
    clearInterval(heartbeat);
  });
});

module.exports = { router, startListening };
