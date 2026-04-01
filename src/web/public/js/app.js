import { initPlayer, playMood } from './player.js';
import { initJournal, prependEntry } from './journal.js';
import { initCalendar, refreshCalendar } from './calendar.js';

const crtFrame = document.getElementById('crtFrame');

function renderInnerWorld(revision) {
  if (!revision) return;
  if (revision.id) {
    crtFrame.src = `/render/${revision.id}`;
  } else {
    crtFrame.src = '/render/latest';
  }
}

async function boot() {
  initPlayer();

  let startDate = '2026-04-01';
  try {
    const statusRes = await fetch('/api/cycle/status');
    const statusData = await statusRes.json();
    if (statusData.success && statusData.data.start_date) {
      startDate = statusData.data.start_date;
    }
  } catch (e) {
    console.warn('[app] Could not fetch cycle status, using default start date');
  }

  initCalendar(startDate);
  initJournal();

  try {
    const res = await fetch('/api/revisions/latest');
    const data = await res.json();
    if (data.success && data.data) {
      if (data.data.mood) playMood(data.data.mood);
    }
  } catch (e) {
    console.warn('[app] No revision loaded yet');
  }

  const events = new EventSource('/api/events');

  events.addEventListener('new_revision', (e) => {
    try {
      const rev = JSON.parse(e.data);
      renderInnerWorld(rev);
      if (rev.journal_entry) prependEntry(rev);
      if (rev.mood) playMood(rev.mood);
      refreshCalendar();

      const led = document.getElementById('powerLed');
      led.style.background = '#f59e0b';
      led.style.boxShadow = '0 0 6px #f59e0b, 0 0 16px rgba(245,158,11,.4)';
      setTimeout(() => {
        led.style.background = '#4ade80';
        led.style.boxShadow = '0 0 6px #4ade80, 0 0 16px rgba(74,222,128,.2)';
      }, 2000);
    } catch (err) {
      console.error('[sse] Failed to process revision:', err);
    }
  });

  events.addEventListener('error', () => {
    console.warn('[sse] Connection lost, will auto-reconnect...');
  });
}

boot();
