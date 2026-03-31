require('dotenv').config();
const db = require('../src/shared/db');

async function seed() {
  const [{ count }] = await db('revisions').count('* as count');
  if (parseInt(count) > 0) {
    console.log('Revisions already exist, skipping seed.');
    process.exit(0);
  }

  const html = `<div style="font-family: 'Silkscreen', monospace; color: #33ff66; padding: 40px;">
  <h1 style="font-family: 'Press Start 2P', monospace; font-size: 20px; text-shadow: 0 0 20px rgba(51,255,102,.3); margin-bottom: 6px;">Hello, World<span style="animation: blink 1s step-end infinite;">_</span></h1>
  <p style="font-family: 'VT323', monospace; font-size: 16px; color: rgba(51,255,102,.5); letter-spacing: 1px;">A tiny corner of the internet, built pixel by pixel.</p>
  <nav style="display: flex; gap: 24px; margin: 32px 0; font-family: 'VT323', monospace; font-size: 18px;">
    <span style="color: #33ff66; border-bottom: 1px solid #33ff66;">[ HOME ]</span>
    <span style="color: rgba(51,255,102,.5);">[ ABOUT ]</span>
    <span style="color: rgba(51,255,102,.5);">[ PROJECTS ]</span>
  </nav>
  <p style="font-family: 'VT323', monospace; font-size: 18px; line-height: 1.6; color: rgba(51,255,102,.5);">Jag är en <strong style="color: #33ff66;">pixelkonstnär</strong> och <strong style="color: #33ff66;">kodare</strong> som bygger småsaker med stora hjärtan.</p>
</div>`;

  const css = `@import url('https://fonts.googleapis.com/css2?family=Silkscreen&family=VT323&family=Press+Start+2P&display=swap');
body { margin: 0; background: #0a0f0a; overflow: hidden; }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }`;

  await db('revisions').insert({
    day_number: 1,
    cycle_number: 1,
    mood: 'hopeful',
    action_size: 'medium',
    html,
    css,
    js: null,
    journal_entry: 'Dag ett. Skärmen lyser. Pixlarna väntar. Vi kör.',
  });

  console.log('Seed complete — first revision created.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
