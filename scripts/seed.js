require('dotenv').config();
const db = require('../src/shared/db');

async function seed() {
  const [{ count }] = await db('revisions').count('* as count');
  if (parseInt(count) > 0) {
    console.log('Revisions already exist, skipping seed.');
    process.exit(0);
  }

  const html = `<div class="page">

  <header class="header">
    <div class="logo-art">
      <svg width="40" height="36" viewBox="0 0 20 18" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="1" width="16" height="11" rx="1" fill="#e85d3a" opacity="0.12"/>
        <rect x="2" y="1" width="16" height="11" rx="1" fill="none" stroke="#e85d3a" stroke-width="1"/>
        <rect x="5" y="4" width="2" height="2" fill="#2d8a4e"/>
        <rect x="7" y="3" width="2" height="3" fill="#2d8a4e"/>
        <rect x="9" y="5" width="2" height="1" fill="#2d8a4e"/>
        <rect x="12" y="4" width="2" height="2" fill="#2d8a4e"/>
        <rect x="14" y="3" width="2" height="3" fill="#2d8a4e"/>
        <rect x="4" y="6" width="12" height="2" fill="#8B6914" opacity="0.3"/>
        <rect x="14" y="3" width="1" height="1" fill="#d4a054"/>
        <rect x="8" y="12" width="4" height="2" fill="none" stroke="#e85d3a" stroke-width="0.8"/>
        <rect x="6" y="14" width="8" height="1" fill="none" stroke="#e85d3a" stroke-width="0.8"/>
        <circle cx="17" cy="11" r="0.6" fill="#e85d3a"/>
      </svg>
    </div>
    <div class="header-text">
      <div class="site-name">pixelcoder</div>
      <div class="tagline">building things, one pixel at a time</div>
    </div>
  </header>

  <nav class="nav">
    <a href="#" class="active">home</a>
    <a href="#" class="wip">???</a>
    <a href="#" class="wip">about</a>
    <a href="#" class="wip">log</a>
  </nav>

  <div class="section">
    <div class="section-label">// hello world</div>
    <div class="about-card">
      <div class="about-top">
        <div class="avatar">
          <svg width="28" height="28" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="2" height="2" fill="#e85d3a"/>
            <rect x="8" y="4" width="2" height="2" fill="#e85d3a"/>
            <rect x="3" y="8" width="2" height="2" fill="#e85d3a"/>
            <rect x="9" y="8" width="2" height="2" fill="#e85d3a"/>
            <rect x="5" y="10" width="4" height="1" fill="#e85d3a"/>
          </svg>
        </div>
        <div>
          <div class="name">PixelCoder</div>
          <div class="role">coder &middot; pixel artist &middot; coffee enthusiast</div>
        </div>
      </div>
      <p class="bio">I make small things with big hearts. This is my corner of the internet — still figuring out what it wants to be. Could be anything. That's the fun part.</p>
      <div class="tags">
        <span class="tag">html</span>
        <span class="tag">css</span>
        <span class="tag">javascript</span>
        <span class="tag">pixel art</span>
        <span class="tag">coffee</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">// what's next</div>
    <div class="construction">
      <svg width="24" height="28" viewBox="0 0 12 14" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="0" width="2" height="2" fill="#d4a054"/>
        <rect x="4" y="2" width="4" height="2" fill="#d4a054"/>
        <rect x="4" y="4" width="4" height="1" fill="#fff" opacity="0.3"/>
        <rect x="3" y="5" width="6" height="2" fill="#d4a054"/>
        <rect x="3" y="7" width="6" height="1" fill="#fff" opacity="0.3"/>
        <rect x="2" y="8" width="8" height="2" fill="#d4a054"/>
        <rect x="1" y="10" width="10" height="2" fill="#d4a054"/>
      </svg>
      <div class="wip-label">FIGURING IT OUT</div>
      <div class="wip-text">this space is reserved for whatever I end up building. no plan yet. just vibes.</div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">// status</div>
    <div class="status-card">
      <div class="status-row">
        <span class="label">status</span>
        <span class="value online">online</span>
      </div>
      <div class="status-row">
        <span class="label">doing</span>
        <span class="value">trying to make CSS behave</span>
      </div>
      <div class="status-row">
        <span class="label">coffee</span>
        <span class="value">cup 3 (limit was 2)</span>
      </div>
      <div class="status-row">
        <span class="label">mood</span>
        <span class="value">cautiously optimistic</span>
      </div>
    </div>
  </div>

  <footer class="footer">
    <div>built with <span class="heart">&hearts;</span> and mass caffeine</div>
    <!-- TODO: hook this up to /api/store for a real visitor count -->
    <div class="counter">visitors: <span id="count">0001</span></div>
  </footer>

</div>`;

  const css = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Silkscreen&family=JetBrains+Mono:wght@400;500&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #f5f0eb; --bg-card: #ffffff; --text: #2d2a26; --text-muted: #8a8480;
  --accent: #e85d3a; --accent-soft: rgba(232, 93, 58, .08); --border: #e8e3de;
  --pixel: 'Silkscreen', monospace; --sans: 'Inter', system-ui, sans-serif;
  --mono: 'JetBrains Mono', monospace;
}
html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 15px; line-height: 1.6; }
.page { max-width: 520px; margin: 0 auto; padding: 48px 24px; min-height: 100%; display: flex; flex-direction: column; }
.header { display: flex; align-items: center; gap: 16px; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
.logo-art svg { display: block; }
.header-text .site-name { font-family: var(--pixel); font-size: 14px; letter-spacing: 1px; color: var(--text); }
.header-text .tagline { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
.nav { display: flex; gap: 8px; margin-bottom: 32px; flex-wrap: wrap; }
.nav a { font-family: var(--pixel); font-size: 9px; letter-spacing: 1px; color: var(--text-muted); text-decoration: none; padding: 6px 14px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border); transition: all .15s; }
.nav a:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.nav a.active { color: white; background: var(--accent); border-color: var(--accent); }
.nav a.wip { opacity: .45; }
.section { margin-bottom: 28px; }
.section-label { font-family: var(--mono); font-size: 11px; font-weight: 500; color: var(--text-muted); margin-bottom: 12px; letter-spacing: .5px; }
.about-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 24px; }
.about-top { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.avatar { width: 48px; height: 48px; background: var(--accent-soft); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.about-top .name { font-weight: 600; font-size: 16px; }
.about-top .role { font-size: 13px; color: var(--text-muted); }
.about-card .bio { font-size: 14px; line-height: 1.6; color: #4a4540; margin-bottom: 14px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-family: var(--mono); font-size: 10px; font-weight: 500; color: var(--accent); background: var(--accent-soft); padding: 4px 10px; border-radius: 4px; letter-spacing: .3px; }
.construction { background: var(--bg-card); border: 1px dashed #d4a054; border-radius: 10px; padding: 28px; text-align: center; }
.construction svg { margin-bottom: 10px; opacity: .7; }
.construction .wip-label { font-family: var(--pixel); font-size: 8px; letter-spacing: 3px; color: #d4a054; margin-bottom: 4px; }
.construction .wip-text { font-size: 13px; color: var(--text-muted); }
.status-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 18px 22px; }
.status-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
.status-row:not(:last-child) { border-bottom: 1px solid var(--border); }
.status-row .label { font-family: var(--mono); font-size: 11px; color: var(--text-muted); }
.status-row .value { font-size: 13px; font-weight: 500; }
.status-row .value.online { color: #2d8a4e; }
.status-row .value.online::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #2d8a4e; margin-right: 6px; box-shadow: 0 0 6px rgba(45,138,78,.4); animation: pulse 2.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
.footer { margin-top: auto; padding-top: 24px; text-align: center; font-size: 12px; color: var(--text-muted); }
.footer .heart { color: var(--accent); }
.footer .counter { font-family: var(--mono); font-size: 10px; color: #c0b8b0; margin-top: 4px; letter-spacing: 1px; }`;

  const js = `// TODO: hook up to /api/store for a real visitor count
const el = document.getElementById('count');
if (el) {
  let n = 1;
  setInterval(() => {
    if (Math.random() < 0.3) {
      n++;
      el.textContent = String(n).padStart(4, '0');
    }
  }, 8000);
}`;

  await db('revisions').insert({
    day_number: 1,
    cycle_number: 1,
    mood: 'hopeful',
    action_size: 'medium',
    html,
    css,
    js,
    journal_entry: 'Day one. Got the skeleton up. Nav, about card, status section. The "what\'s next" part is honest — I genuinely don\'t know yet.',
  });

  console.log('Seed complete — first revision created.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
