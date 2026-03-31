require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Static assets (mp4s, images)
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// API routes (added in later tasks)
// app.use('/api/revisions', require('./routes/revisions'));
// app.use('/api/journal', require('./routes/journal'));
// app.use('/api/events', require('./routes/events'));
// app.use('/api/cycle', require('./routes/admin'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[web] PixelCoder running on http://localhost:${PORT}`);
});

module.exports = app;
