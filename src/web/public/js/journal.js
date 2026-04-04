let container;
let currentPage = 1;
let loading = false;
let hasMore = true;
let filterDay = null;
const seenIds = new Set();

function renderEntry(entry) {
  const div = document.createElement('div');
  div.className = 'diary-entry';
  div.dataset.id = entry.id;
  div.innerHTML = `
    <div class="diary-date">DAY ${entry.day_number}</div>
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
    if (entries.length === 0 || (data.meta && !data.meta.has_more)) {
      hasMore = false;
    }
    if (entries.length === 0) return;

    entries.forEach(entry => {
      if (seenIds.has(entry.id)) return;
      seenIds.add(entry.id);
      container.appendChild(renderEntry(entry));
    });

    currentPage = page;
  } finally {
    loading = false;
  }
}

export function prependEntry(entry) {
  if (seenIds.has(entry.id)) return;
  seenIds.add(entry.id);

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
  seenIds.clear();
  currentPage = 1;
  hasMore = true;
  loadPage(1);
}

export function clearFilter() {
  filterDay = null;
  container.innerHTML = '';
  seenIds.clear();
  currentPage = 1;
  hasMore = true;
  loadPage(1);
}

export function initJournal() {
  container = document.getElementById('journalEntries');

  const section = document.getElementById('diary');

  // Infinite scroll handler — works on whichever element is scrolling
  function onScroll(e) {
    const el = e.target;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 50 && !loading && hasMore) {
      loadPage(currentPage + 1);
    }
  }

  // Desktop/tablet: #diary itself scrolls (overflow-y: auto)
  section.addEventListener('scroll', onScroll);

  // Mobile: #diary is overflow:hidden flex column, #journalEntries scrolls
  container.addEventListener('scroll', onScroll);

  loadPage(1);
}
