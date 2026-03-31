let container;
let currentPage = 1;
let loading = false;
let hasMore = true;
let filterDay = null;

function renderEntry(entry) {
  const div = document.createElement('div');
  div.className = 'diary-entry';
  div.innerHTML = `
    <div class="diary-date">DAG ${entry.day_number}</div>
    <div class="diary-text">${entry.journal_entry}</div>
  `;
  return div;
}

async function loadPage(page) {
  if (loading || !hasMore) return;
  loading = true;

  try {
    const url = filterDay
      ? `/api/journal/day/${filterDay}`
      : `/api/journal?page=${page}&limit=15`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) return;

    const entries = data.data;
    if (entries.length === 0) {
      hasMore = false;
      return;
    }

    entries.forEach(entry => {
      container.appendChild(renderEntry(entry));
    });

    currentPage = page;
  } finally {
    loading = false;
  }
}

export function prependEntry(entry) {
  const el = renderEntry(entry);
  el.style.opacity = '0';
  el.style.transform = 'translateY(-10px)';
  container.prepend(el);

  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.5s, transform 0.5s';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
}

export function filterByDay(day) {
  filterDay = day;
  container.innerHTML = '';
  currentPage = 1;
  hasMore = true;
  loadPage(1);
}

export function clearFilter() {
  filterDay = null;
  container.innerHTML = '';
  currentPage = 1;
  hasMore = true;
  loadPage(1);
}

export function initJournal() {
  container = document.getElementById('journalEntries');

  const section = document.getElementById('diary');
  section.addEventListener('scroll', () => {
    if (section.scrollTop < 50 && !loading && hasMore) {
      loadPage(currentPage + 1);
    }
  });

  loadPage(1);
}
