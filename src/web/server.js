require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// API routes
app.use('/api/revisions', require('./routes/revisions'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/store', require('./routes/store'));
app.use('/api/cycle', require('./routes/admin'));

// SSE
const { router: eventsRouter, startListening } = require('./routes/events');
app.use('/api/events', eventsRouter);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`[web] PixelCoder running on http://localhost:${PORT}`);
  try {
    await startListening();
  } catch (err) {
    console.error('[web] Failed to start pg LISTEN — SSE will not work:', err.message);
  }
});

module.exports = app;
