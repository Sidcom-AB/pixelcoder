const express = require('express');
const path = require('path');
const router = express.Router();

function requireSecret(req, res, next) {
  const secret = process.env.API_SECRET;
  if (!secret) return res.status(500).send('API_SECRET not configured');

  const provided = req.query.secret || req.cookies?.secret;
  if (provided !== secret) {
    return res.send(loginPage());
  }
  req.apiSecret = secret;
  next();
}

function loginPage() {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><title>Admin — PixelCoder</title>
<style>${adminCSS()}</style>
</head><body>
<div class="admin">
  <h1>// admin.access</h1>
  <form method="GET" class="login-form">
    <input type="password" name="secret" placeholder="API_SECRET" autofocus>
    <button type="submit">LOGIN</button>
  </form>
</div>
</body></html>`;
}

function adminCSS() {
  return `
@import url('https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=VT323&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #111A23; color: #d4a054; font-family: 'VT323', monospace; min-height: 100vh; }
.admin { max-width: 900px; margin: 0 auto; padding: 24px; }
h1 { font-family: 'Silkscreen', monospace; font-size: 12px; letter-spacing: 3px; color: rgba(212,160,84,.6); margin-bottom: 20px; }
h2 { font-family: 'Silkscreen', monospace; font-size: 10px; letter-spacing: 2px; color: rgba(212,160,84,.5); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(212,160,84,.15); }

.login-form { display: flex; gap: 8px; }
.login-form input { background: rgba(255,255,255,.06); border: 1px solid rgba(212,160,84,.25); color: #d4a054; font-family: 'VT323', monospace; font-size: 20px; padding: 10px 14px; border-radius: 2px; flex: 1; outline: none; }
.login-form input:focus { border-color: rgba(212,160,84,.4); }
.login-form button, .btn { background: rgba(212,160,84,.12); border: 1px solid rgba(212,160,84,.3); color: #d4a054; font-family: 'Silkscreen', monospace; font-size: 9px; letter-spacing: 1px; padding: 10px 18px; border-radius: 2px; cursor: pointer; transition: all .2s; }
.login-form button:hover, .btn:hover { background: rgba(212,160,84,.2); border-color: rgba(212,160,84,.4); }
.btn-danger { color: #f87171; border-color: rgba(248,113,113,.2); background: rgba(248,113,113,.05); }
.btn-danger:hover { background: rgba(248,113,113,.15); border-color: rgba(248,113,113,.4); }

.panel { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-radius: 3px; padding: 16px; margin-bottom: 20px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-radius: 3px; padding: 14px; }
.stat-label { font-family: 'Silkscreen', monospace; font-size: 8px; letter-spacing: 2px; color: rgba(212,160,84,.45); margin-bottom: 6px; }
.stat-value { font-size: 26px; color: #d4a054; }

.actions { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.trigger-status { font-size: 16px; color: rgba(212,160,84,.5); margin-left: 8px; }
.trigger-status.ok { color: #4ade80; }
.trigger-status.err { color: #f87171; }

table { width: 100%; border-collapse: collapse; }
th { font-family: 'Silkscreen', monospace; font-size: 8px; letter-spacing: 1px; color: rgba(212,160,84,.5); text-align: left; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,.06); }
td { font-size: 18px; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,.03); color: rgba(212,160,84,.75); vertical-align: top; }
tr:hover td { background: rgba(255,255,255,.02); }
.mono { font-family: 'VT323', monospace; }
.dim { color: rgba(212,160,84,.45); }
.truncate { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-expand { cursor: pointer; }
.log-expand:hover { color: #d4a054; }
.log-detail { display: none; margin-top: 8px; padding: 12px; background: rgba(0,0,0,.3); border: 1px solid rgba(255,255,255,.04); border-radius: 2px; font-size: 16px; white-space: pre-wrap; word-break: break-word; max-height: 400px; overflow-y: auto; color: rgba(212,160,84,.6); }
.log-detail.open { display: block; }
.pagination { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
.pagination span { font-size: 14px; color: rgba(212,160,84,.3); }
a { color: #d4a054; text-decoration: none; }
a:hover { color: rgba(212,160,84,.8); }
.back-link { display: inline-block; margin-bottom: 16px; font-family: 'Silkscreen', monospace; font-size: 7px; letter-spacing: 1px; color: rgba(212,160,84,.3); }
.back-link:hover { color: rgba(212,160,84,.6); }
.settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.settings-grid label { display: flex; flex-direction: column; gap: 4px; }
.setting-label { font-family: 'Silkscreen', monospace; font-size: 7px; letter-spacing: 1px; color: rgba(212,160,84,.45); }
.settings-grid input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); color: #d4a054; font-family: 'VT323', monospace; font-size: 20px; padding: 8px 10px; border-radius: 2px; outline: none; width: 100%; }
.settings-grid input:focus { border-color: rgba(212,160,84,.4); }
`;
}

router.get('/', requireSecret, async (req, res) => {
  const db = require('../../shared/db');
  try {
    const stateRows = await db('app_state').select('*');
    const state = {};
    stateRows.forEach(r => { state[r.key] = r.value; });

    const lastRevision = await db('revisions').orderBy('id', 'desc').first();
    const revisionCount = await db('revisions').count('* as count').first();
    const logCount = await db('cycle_logs').count('* as count').first();

    const recentLogs = await db('cycle_logs').orderBy('id', 'desc').limit(20);

    const s = req.apiSecret;

    res.type('html').send(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><title>Admin — PixelCoder</title>
<meta http-equiv="refresh" content="15">
<style>${adminCSS()}</style>
</head><body>
<div class="admin">
  <h1>// admin.panel</h1>

  ${(() => {
    try {
      const hb = JSON.parse(state.worker_heartbeat || '{}');
      if (hb.timestamp) {
        const ago = Math.round((Date.now() - new Date(hb.timestamp).getTime()) / 1000);
        const status = ago < 60 ? 'ok' : ago < 120 ? 'warning' : 'stale';
        const color = status === 'ok' ? '#4ade80' : status === 'warning' ? '#f59e0b' : '#f87171';
        return '<div class="worker-status" style="margin-bottom:16px; font-size:16px;"><span style="color:' + color + '">●</span> Worker: interval ' + hb.interval + 'h — last seen ' + ago + 's ago</div>';
      }
    } catch {}
    return '<div class="worker-status" style="margin-bottom:16px; font-size:16px;"><span style="color:#f87171">●</span> Worker: no heartbeat</div>';
  })()}

  <div class="stats">
    <div class="stat">
      <div class="stat-label">CURRENT DAY</div>
      <div class="stat-value">${state.current_day || '0'}</div>
    </div>
    <div class="stat">
      <div class="stat-label">TOTAL CYCLES</div>
      <div class="stat-value">${state.total_cycles || '0'}</div>
    </div>
    <div class="stat">
      <div class="stat-label">REVISIONS</div>
      <div class="stat-value">${revisionCount?.count || '0'}</div>
    </div>
    <div class="stat">
      <div class="stat-label">CYCLE LOGS</div>
      <div class="stat-value">${logCount?.count || '0'}</div>
    </div>
    <div class="stat">
      <div class="stat-label">MODEL</div>
      <div class="stat-value" style="font-size:14px">${process.env.CLAUDE_MODEL || 'default'}</div>
    </div>
  </div>

  <h2>// settings</h2>
  <div class="panel">
    <div class="settings-grid">
      <label>
        <span class="setting-label">CYCLE INTERVAL (hours)</span>
        <input type="number" id="s_cycle_interval_hours" value="${state.cycle_interval_hours || '3'}" min="1" max="24">
      </label>
      <label>
        <span class="setting-label">DAILY TOKEN BUDGET</span>
        <input type="number" id="s_daily_token_budget" value="${state.daily_token_budget || '120000'}" min="1000" step="1000">
      </label>
      <label>
        <span class="setting-label">LOG RETAIN (days)</span>
        <input type="number" id="s_cycle_logs_retain_days" value="${state.cycle_logs_retain_days || '90'}" min="1">
      </label>
      <label>
        <span class="setting-label">START DATE</span>
        <input type="date" id="s_start_date" value="${state.start_date || '2026-04-01'}">
      </label>
    </div>
    <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
      <button class="btn" onclick="saveSettings()">SAVE SETTINGS</button>
      <span class="trigger-status" id="settingsStatus"></span>
    </div>
  </div>

  ${lastRevision ? `
  <h2>// latest revision</h2>
  <div class="panel">
    <table>
      <tr><th>ID</th><th>DAY</th><th>CYCLE</th><th>MOOD</th><th>ACTION</th><th>CREATED</th></tr>
      <tr>
        <td>${lastRevision.id}</td>
        <td>${lastRevision.day_number}</td>
        <td>${lastRevision.cycle_number || '-'}</td>
        <td>${lastRevision.mood || '-'}</td>
        <td>${lastRevision.action_size || '-'}</td>
        <td class="dim">${lastRevision.created_at ? new Date(lastRevision.created_at).toLocaleString() : '-'}</td>
      </tr>
    </table>
  </div>` : ''}

  <h2>// actions</h2>
  <div class="actions">
    <button class="btn" onclick="triggerCycle()">TRIGGER CYCLE</button>
    <span class="trigger-status" id="triggerStatus"></span>
  </div>

  <h2>// recent cycle logs</h2>
  <div class="panel">
    ${recentLogs.length === 0 ? '<p class="dim" style="font-size:16px">No logs yet.</p>' : `
    <table>
      <tr><th>ID</th><th>REV</th><th>STEP</th><th>TOKENS</th><th>DURATION</th><th>TIME</th><th></th></tr>
      ${recentLogs.map(log => `
      <tr>
        <td>${log.id}</td>
        <td>${log.revision_id || '-'}</td>
        <td>${log.step_number}</td>
        <td>${log.tokens_used || '-'}</td>
        <td>${log.duration_ms ? log.duration_ms + 'ms' : '-'}</td>
        <td class="dim">${log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
        <td><span class="log-expand" onclick="toggleLog(${log.id})">+</span></td>
      </tr>
      <tr><td colspan="7"><div class="log-detail" id="log-${log.id}"><strong>Prompt:</strong>\n${escapeHtml(truncate(log.prompt_sent, 2000))}\n\n<strong>Response:</strong>\n${escapeHtml(truncate(log.response_raw, 2000))}${log.error ? '\n\n<strong style="color:#f87171">Error:</strong>\n' + escapeHtml(log.error) : ''}</div></td></tr>
      `).join('')}
    </table>`}
  </div>
</div>
<script>
const SECRET = '${s}';
async function triggerCycle() {
  const el = document.getElementById('triggerStatus');
  el.textContent = 'triggering...';
  el.className = 'trigger-status';
  try {
    const res = await fetch('/api/cycle/trigger', {
      method: 'POST',
      headers: { 'x-api-secret': SECRET }
    });
    const data = await res.json();
    if (data.success) {
      el.textContent = 'triggered!';
      el.className = 'trigger-status ok';
    } else {
      el.textContent = data.error || 'failed';
      el.className = 'trigger-status err';
    }
  } catch (e) {
    el.textContent = 'error: ' + e.message;
    el.className = 'trigger-status err';
  }
}
async function saveSettings() {
  const el = document.getElementById('settingsStatus');
  el.textContent = 'saving...';
  el.className = 'trigger-status';
  try {
    const body = {
      cycle_interval_hours: document.getElementById('s_cycle_interval_hours').value,
      daily_token_budget: document.getElementById('s_daily_token_budget').value,
      cycle_logs_retain_days: document.getElementById('s_cycle_logs_retain_days').value,
      start_date: document.getElementById('s_start_date').value,
    };
    const res = await fetch('/api/cycle/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': SECRET },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      el.textContent = 'saved! (' + data.changed.join(', ') + ')';
      el.className = 'trigger-status ok';
    } else {
      el.textContent = data.error || 'failed';
      el.className = 'trigger-status err';
    }
  } catch (e) {
    el.textContent = 'error: ' + e.message;
    el.className = 'trigger-status err';
  }
}
function toggleLog(id) {
  document.getElementById('log-' + id).classList.toggle('open');
}
</script>
</body></html>`);
  } catch (err) {
    console.error('[admin-page] error:', err);
    res.status(500).send('Internal server error');
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, max) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max) + '\n... (truncated)';
}

module.exports = router;
