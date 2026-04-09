// ============================================================
// Config
// ============================================================
const SECRET = document.cookie.match(/secret=([^;]+)/)?.[1] || '';
const HEADERS = { 'x-api-secret': SECRET, 'Content-Type': 'application/json' };
const REFRESH_MS = 15000;
const EDITABLE_KEYS = {
  cycle_interval_hours:   { type: 'number', min: 1, max: 24, label: 'Cycle Interval (hours)' },
  daily_token_budget:     { type: 'number', min: 1000, step: 1000, label: 'Daily Token Budget' },
  cycle_logs_retain_days: { type: 'number', min: 1, label: 'Log Retain (days)' },
  start_date:             { type: 'date', label: 'Start Date' },
  claude_model:           { type: 'select', label: 'Claude Model', options: [
    { value: 'claude-opus-4-6', text: 'claude-opus-4-6' },
    { value: 'claude-sonnet-4-6', text: 'claude-sonnet-4-6' },
    { value: 'claude-haiku-4-5-20251001', text: 'claude-haiku-4-5' },
  ]},
};

// Claude pricing per million tokens (USD) — from claude.ai/pricing 2026-04
const MODEL_PRICING = {
  'claude-opus-4-6':          { input: 5,    output: 25   },
  'claude-sonnet-4-6':        { input: 3,    output: 15   },
  'claude-haiku-4-5-20251001':{ input: 1,    output: 5    },
};

/**
 * Estimate cost for a given token count.
 * Assumes ~60% input, ~40% output ratio (typical for tool-use cycles).
 */
function estimateCost(tokens, model) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-opus-4-6'];
  const inputTokens = tokens * 0.6;
  const outputTokens = tokens * 0.4;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

function formatUSD(amount) {
  if (amount < 0.01) return '<$0.01';
  return '$' + amount.toFixed(2);
}

// ============================================================
// Utility helpers
// ============================================================

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatDuration(ms) {
  if (ms == null) return '—';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}m ${rem}s` : `${min}m`;
}

async function api(method, path, body) {
  const opts = { method, headers: HEADERS };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
  return json;
}

// ============================================================
// Tab switching
// ============================================================

let dashboardInterval = null;
const tabButtons = () => document.querySelectorAll('button.tab[data-tab]');
const tabSections = () => document.querySelectorAll('.tab-content');

function switchTab(tabName) {
  tabButtons().forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  tabSections().forEach(s => s.classList.toggle('active', s.id === `tab-${tabName}`));
  location.hash = tabName;

  // Clear dashboard auto-refresh when leaving dashboard
  if (dashboardInterval) {
    clearInterval(dashboardInterval);
    dashboardInterval = null;
  }

  // Load tab data
  switch (tabName) {
    case 'dashboard':
      loadDashboard();
      dashboardInterval = setInterval(loadDashboard, REFRESH_MS);
      break;
    case 'logs':
      loadLogs();
      break;
    case 'revisions':
      loadRevisions();
      break;
    case 'journal':
      loadJournal();
      break;
    case 'appstate':
      loadAppState();
      break;
  }
}

// ============================================================
// Dashboard
// ============================================================

async function loadDashboard() {
  try {
    const [statusRes, tokenRes, stateRes] = await Promise.all([
      api('GET', '/api/cycle/status'),
      api('GET', '/api/cycle/token-usage'),
      api('GET', '/api/cycle/app-state'),
    ]);

    const status = statusRes.data;
    const tokenData = tokenRes.data;
    const stateRows = stateRes.data;

    // Stat cards
    const model = getStateValue(stateRows, 'claude_model') || 'claude-opus-4-6';
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="stat-value">${escapeHtml(status.current_day)}</div><div class="stat-label">Current Day</div></div>
      <div class="stat-card"><div class="stat-value">${escapeHtml(status.total_cycles)}</div><div class="stat-label">Total Cycles</div></div>
      <div class="stat-card"><div class="stat-value">${status.last_revision ? escapeHtml(status.last_revision.id) : '—'}</div><div class="stat-label">Latest Revision</div></div>
      <div class="stat-card"><div class="stat-value mono">${escapeHtml(model)}</div><div class="stat-label">Model</div></div>
    `;

    // Latest revision
    const rev = status.last_revision;
    document.getElementById('latestRevisionBody').innerHTML = rev
      ? `<tr>
          <td class="mono">${escapeHtml(rev.id)}</td>
          <td>${escapeHtml(rev.day_number)}</td>
          <td>${escapeHtml(rev.cycle_number)}</td>
          <td>${escapeHtml(rev.mood)}</td>
          <td>${escapeHtml(rev.action_size)}</td>
          <td>${formatDate(rev.created_at)}</td>
        </tr>`
      : '<tr><td colspan="6">No revisions yet</td></tr>';

    // Token budget
    const budget = Number(getStateValue(stateRows, 'daily_token_budget')) || 300000;
    const today = new Date().toISOString().slice(0, 10);
    const todayUsage = tokenData.daily?.find(d => d.date === today);
    const usedToday = todayUsage ? todayUsage.tokens : 0;
    const pct = Math.min(100, Math.round((usedToday / budget) * 100));
    document.getElementById('budgetFill').style.width = `${pct}%`;
    document.getElementById('budgetText').textContent =
      `${usedToday.toLocaleString()} / ${budget.toLocaleString()} tokens today (${pct}%)`;

    // Worker status
    renderWorkerStatus(stateRows);

    // Cost estimates
    const totalTokens = tokenData.total_tokens || 0;
    const totalCost = estimateCost(totalTokens, model);
    const todayCost = estimateCost(usedToday, model);
    const dailyBudgetCost = estimateCost(budget, model);
    const monthlyCost = dailyBudgetCost * 30;
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-opus-4-6'];

    document.getElementById('costEstimate').innerHTML = `
      <div class="stat-card"><div class="stat-value">${totalTokens.toLocaleString()}</div><div class="stat-label">Total Tokens Used</div></div>
      <div class="stat-card"><div class="stat-value">${formatUSD(totalCost)}</div><div class="stat-label">Total Cost</div></div>
      <div class="stat-card"><div class="stat-value">${formatUSD(todayCost)}</div><div class="stat-label">Today's Cost</div></div>
      <div class="stat-card"><div class="stat-value">${formatUSD(monthlyCost)}</div><div class="stat-label">Est. Monthly (at budget)</div></div>
      <div class="stat-card"><div class="stat-value mono">${escapeHtml(model)}</div><div class="stat-label">Model</div></div>
      <div class="stat-card"><div class="stat-value mono">$${pricing.input} / $${pricing.output}</div><div class="stat-label">Price (in/out per MTok)</div></div>
    `;

    // Daily usage table
    document.getElementById('tokenUsageBody').innerHTML = (tokenData.daily || []).map(d => {
      const tokens = Number(d.tokens);
      const cost = estimateCost(tokens, model);
      return `
      <tr>
        <td>${escapeHtml(d.date)}</td>
        <td class="mono">${tokens.toLocaleString()}</td>
        <td class="mono">${d.cycles}</td>
        <td class="mono">${formatUSD(cost)}</td>
      </tr>`;
    }).join('');

  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function getStateValue(rows, key) {
  const row = rows.find(r => r.key === key);
  return row ? row.value : null;
}

function renderWorkerStatus(stateRows) {
  const raw = getStateValue(stateRows, 'worker_heartbeat');
  const el = document.getElementById('workerStatus');
  if (!raw) {
    el.innerHTML = '<span class="dot dot-red"></span> Worker: no heartbeat';
    return;
  }
  try {
    const hb = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const ago = (Date.now() - new Date(hb.timestamp).getTime()) / 1000;
    let dotClass = 'dot-green';
    if (ago > 120) dotClass = 'dot-red';
    else if (ago > 60) dotClass = 'dot-yellow';
    el.innerHTML = `<span class="dot ${dotClass}"></span> Worker: ${Math.round(ago)}s ago (interval: ${hb.interval || '?'})`;
  } catch {
    el.innerHTML = '<span class="dot dot-red"></span> Worker: invalid heartbeat';
  }
}

// ============================================================
// Logs
// ============================================================

let logsPage = 1;

async function loadLogs(page = 1, search, errorsOnly) {
  logsPage = page;
  if (search === undefined) search = document.getElementById('logSearch').value;
  if (errorsOnly === undefined) errorsOnly = document.getElementById('logErrorsOnly').checked;

  const params = new URLSearchParams({ page, limit: 20 });
  if (search) params.set('search', search);
  if (errorsOnly) params.set('errors_only', 'true');

  try {
    const res = await api('GET', `/api/cycle/logs?${params}`);
    const logs = res.data;
    const meta = res.meta;

    const tbody = document.getElementById('logsBody');
    tbody.innerHTML = logs.map(log => `
      <tr>
        <td class="mono">${escapeHtml(log.id)}</td>
        <td class="mono">${escapeHtml(log.revision_id)}</td>
        <td>${escapeHtml(log.step_number)}</td>
        <td class="mono">${log.tokens_used != null ? Number(log.tokens_used).toLocaleString() : '—'}</td>
        <td class="mono">${formatDuration(log.duration_ms)}</td>
        <td>${formatDate(log.created_at)}</td>
        <td>${log.error ? '<span class="dot dot-red" title="Error"></span>' : ''}</td>
        <td><button class="btn btn-sm expand-btn" data-log-id="${log.id}">+</button></td>
      </tr>
      <tr class="log-detail-row" id="log-detail-${log.id}" style="display:none;">
        <td colspan="8">
          <div class="log-detail">
            <h4>Prompt Sent</h4>
            <pre class="mono">${escapeHtml(log.prompt_sent)}</pre>
            <h4>Response</h4>
            <pre class="mono">${escapeHtml(log.response_raw)}</pre>
            ${log.error ? `<h4>Error</h4><pre class="mono" style="color:var(--danger);">${escapeHtml(log.error)}</pre>` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    // Expand/collapse handlers
    tbody.querySelectorAll('.expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const detailRow = document.getElementById(`log-detail-${btn.dataset.logId}`);
        const open = detailRow.style.display !== 'none';
        detailRow.style.display = open ? 'none' : 'table-row';
        btn.textContent = open ? '+' : '−';
      });
    });

    // Pagination
    renderPagination('logsPagination', meta, (p) => loadLogs(p));

  } catch (err) {
    console.error('Logs load error:', err);
  }
}

// ============================================================
// Revisions
// ============================================================

let revisionsPage = 1;

async function loadRevisions(page = 1) {
  revisionsPage = page;
  try {
    const res = await api('GET', `/api/cycle/revisions?page=${page}&limit=20`);
    const revisions = res.data;
    const meta = res.meta;

    const tbody = document.getElementById('revisionsBody');
    tbody.innerHTML = revisions.map(rev => `
      <tr class="clickable-row" data-rev-id="${rev.id}">
        <td class="mono">${escapeHtml(rev.id)}</td>
        <td>${escapeHtml(rev.day_number)}</td>
        <td>${escapeHtml(rev.cycle_number)}</td>
        <td>${escapeHtml(rev.mood)}</td>
        <td>${escapeHtml(rev.action_size)}</td>
        <td>${formatDate(rev.created_at)}</td>
      </tr>
    `).join('');

    // Row click -> preview
    tbody.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.revId;
        const preview = document.getElementById('revisionPreview');
        preview.style.display = 'block';
        document.getElementById('previewRevisionId').textContent = id;
        document.getElementById('revisionIframe').src = `/render/${id}`;
      });
    });

    renderPagination('revisionsPagination', meta, (p) => loadRevisions(p));

  } catch (err) {
    console.error('Revisions load error:', err);
  }
}

// ============================================================
// Journal
// ============================================================

let journalPage = 1;

async function loadJournal(page = 1) {
  journalPage = page;
  try {
    const res = await api('GET', `/api/cycle/revisions?page=${page}&limit=20`);
    const revisions = res.data;
    const meta = res.meta;

    const tbody = document.getElementById('journalBody');
    tbody.innerHTML = revisions.map(rev => {
      const entry = rev.journal_entry || '';
      const truncated = entry.length > 120 ? entry.slice(0, 120) + '...' : entry;
      return `
      <tr>
        <td class="mono">${escapeHtml(rev.id)}</td>
        <td>${escapeHtml(rev.day_number)}</td>
        <td>${escapeHtml(rev.cycle_number)}</td>
        <td>${escapeHtml(rev.mood)}</td>
        <td>
          <span class="journal-text" id="journal-text-${rev.id}">${escapeHtml(truncated)}</span>
          <textarea class="journal-edit filter-input" id="journal-edit-${rev.id}" style="display:none; width:100%; min-height:60px;">${escapeHtml(entry)}</textarea>
        </td>
        <td>${formatDate(rev.created_at)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm journal-edit-btn" data-id="${rev.id}">Edit</button>
          <button class="btn btn-sm btn-danger journal-del-btn" data-id="${rev.id}">Del</button>
        </td>
      </tr>`;
    }).join('');

    // Edit handlers
    tbody.querySelectorAll('.journal-edit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const textEl = document.getElementById(`journal-text-${id}`);
        const editEl = document.getElementById(`journal-edit-${id}`);

        if (btn.textContent === 'Edit') {
          textEl.style.display = 'none';
          editEl.style.display = 'block';
          btn.textContent = 'Save';
        } else {
          try {
            await api('PUT', `/api/cycle/revisions/${id}/journal`, { journal_entry: editEl.value });
            btn.textContent = 'Edit';
            loadJournal(journalPage);
          } catch (err) {
            alert(`Error saving: ${err.message}`);
          }
        }
      });
    });

    // Delete handlers
    tbody.querySelectorAll('.journal-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm(`Delete revision ${id} and its journal entry? This cannot be undone.`)) return;
        try {
          await api('DELETE', `/api/cycle/revisions/${id}`);
          loadJournal(journalPage);
        } catch (err) {
          alert(`Error deleting: ${err.message}`);
        }
      });
    });

    renderPagination('journalPagination', meta, (p) => loadJournal(p));

  } catch (err) {
    console.error('Journal load error:', err);
  }
}

// ============================================================
// App State
// ============================================================

function renderEditableInput(key, cfg, value) {
  const id = `appstate-input-${key}`;
  if (cfg.type === 'select') {
    const opts = cfg.options.map(o =>
      `<option value="${escapeHtml(o.value)}"${o.value === value ? ' selected' : ''}>${escapeHtml(o.text)}</option>`
    ).join('');
    return `<select id="${id}" class="filter-input" style="width:220px;">${opts}</select>`;
  }
  const attrs = [`type="${cfg.type}"`, `id="${id}"`, 'class="filter-input"', 'style="width:220px;"'];
  if (value != null) attrs.push(`value="${escapeHtml(value)}"`);
  if (cfg.min != null) attrs.push(`min="${cfg.min}"`);
  if (cfg.max != null) attrs.push(`max="${cfg.max}"`);
  if (cfg.step != null) attrs.push(`step="${cfg.step}"`);
  return `<input ${attrs.join(' ')}>`;
}

async function loadAppState() {
  try {
    const [stateRes, statusRes] = await Promise.all([
      api('GET', '/api/cycle/app-state'),
      api('GET', '/api/cycle/status'),
    ]);
    const rows = stateRes.data;

    document.getElementById('appStateBody').innerHTML = rows.map(row => {
      const cfg = EDITABLE_KEYS[row.key];
      const valueCell = cfg
        ? renderEditableInput(row.key, cfg, row.value)
        : `<span class="mono">${escapeHtml(row.value)}</span>`;
      return `
        <tr>
          <td class="mono">${escapeHtml(row.key)}</td>
          <td>${valueCell}</td>
          <td>${formatDate(row.updated_at)}</td>
        </tr>
      `;
    }).join('');

    // Worker info
    const raw = getStateValue(rows, 'worker_heartbeat');
    const workerInfo = document.getElementById('workerInfo');
    if (!raw) {
      workerInfo.textContent = 'No worker heartbeat detected.';
    } else {
      try {
        const hb = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const ago = (Date.now() - new Date(hb.timestamp).getTime()) / 1000;
        workerInfo.innerHTML = `
          <p>Last heartbeat: <strong>${formatDate(hb.timestamp)}</strong> (${Math.round(ago)}s ago)</p>
          <p>Interval: <strong>${hb.interval || '?'}</strong></p>
          <p>Cycle interval: <strong>${statusRes.data.cycle_interval_hours}h</strong></p>
          <p>Start date: <strong>${statusRes.data.start_date}</strong></p>
        `;
      } catch {
        workerInfo.textContent = 'Invalid worker heartbeat data.';
      }
    }

  } catch (err) {
    console.error('App state load error:', err);
  }
}

// ============================================================
// Settings & Actions
// ============================================================

async function saveSettings() {
  const statusEl = document.getElementById('settingsStatus');
  statusEl.textContent = 'Saving...';
  try {
    const body = {};
    for (const key of Object.keys(EDITABLE_KEYS)) {
      const el = document.getElementById(`appstate-input-${key}`);
      if (!el) continue;
      const cfg = EDITABLE_KEYS[key];
      body[key] = cfg.type === 'number' ? Number(el.value) : el.value;
    }
    const res = await api('PUT', '/api/cycle/settings', body);
    statusEl.textContent = res.changed?.length
      ? `Saved: ${res.changed.join(', ')}`
      : 'No changes detected.';
    setTimeout(() => { statusEl.textContent = ''; }, 4000);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
}

async function triggerCycle(statusElId) {
  const statusEl = document.getElementById(statusElId);
  statusEl.textContent = 'Triggering...';
  try {
    const res = await api('POST', '/api/cycle/trigger');
    statusEl.textContent = res.message || 'Cycle triggered!';
    setTimeout(() => { statusEl.textContent = ''; }, 5000);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
}

async function clearLogs() {
  const days = Number(document.getElementById('clearLogsDays').value);
  if (!days || days < 1) return alert('Enter a valid number of days.');
  if (!confirm(`Delete all logs older than ${days} days? This cannot be undone.`)) return;

  try {
    const res = await api('DELETE', `/api/cycle/logs?older_than_days=${days}`);
    alert(`Deleted ${res.deleted || 0} log entries.`);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ============================================================
// Pagination helper
// ============================================================

function renderPagination(elementId, meta, loadFn) {
  const el = document.getElementById(elementId);
  if (!meta) { el.innerHTML = ''; return; }

  const totalPages = Math.ceil(meta.total / meta.limit) || 1;
  const page = meta.page;

  el.innerHTML = `
    <button class="btn btn-sm" ${page <= 1 ? 'disabled' : ''} id="${elementId}-prev">Prev</button>
    <span class="muted">Page ${page} of ${totalPages}</span>
    <button class="btn btn-sm" ${page >= totalPages ? 'disabled' : ''} id="${elementId}-next">Next</button>
  `;

  document.getElementById(`${elementId}-prev`)?.addEventListener('click', () => {
    if (page > 1) loadFn(page - 1);
  });
  document.getElementById(`${elementId}-next`)?.addEventListener('click', () => {
    if (page < totalPages) loadFn(page + 1);
  });
}

// ============================================================
// Init
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Tab click handlers
  tabButtons().forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Log search
  document.getElementById('logSearchBtn').addEventListener('click', () => loadLogs(1));
  document.getElementById('logSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadLogs(1);
  });
  document.getElementById('logErrorsOnly').addEventListener('change', () => loadLogs(1));

  // Settings
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

  // Trigger cycle buttons
  document.getElementById('triggerCycleBtn').addEventListener('click', () => triggerCycle('triggerStatus'));
  document.getElementById('triggerCycleBtn2').addEventListener('click', () => triggerCycle('triggerStatus2'));

  // Refuel
  document.getElementById('refuelBtn').addEventListener('click', async () => {
    if (!confirm('Restore 70% of today\'s token budget?')) return;
    const res = await api('POST', '/api/cycle/refuel');
    alert(res.message || 'Refueled!');
    loadDashboard();
  });

  // Clear logs
  document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);

  // Restore tab from hash or default to dashboard
  const hash = location.hash.replace('#', '');
  const validTabs = ['dashboard', 'logs', 'revisions', 'journal', 'appstate'];
  switchTab(validTabs.includes(hash) ? hash : 'dashboard');
});
