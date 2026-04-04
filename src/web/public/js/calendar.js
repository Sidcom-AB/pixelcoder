import { filterByDay, clearFilter } from './journal.js';

let calendarData = {};
let currentMonth = new Date();
let startDate;

const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

async function loadCalendarData() {
  try {
    const res = await fetch('/api/revisions/calendar');
    const data = await res.json();
    if (data.success) {
      calendarData = {};
      data.data.forEach(d => {
        calendarData[d.day_number] = { count: d.count, moods: d.moods };
      });
      renderAll();
    }
  } catch (e) {
    console.error('[calendar] Failed to load:', e);
  }
}

function dayNumberFromDate(date) {
  if (!startDate) return -1;
  const diff = date - startDate;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

function buildCalendarGridHTML() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleString('sv-SE', { month: 'short', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  let html = `
    <div class="calendar-header">
      <button class="cal-prev">&lt;</button>
      <span>${monthName.toUpperCase()}</span>
      <button class="cal-next">&gt;</button>
    </div>
    <div class="calendar-weekdays">
      ${WEEKDAYS.map(d => `<span>${d}</span>`).join('')}
    </div>
    <div class="calendar-grid">
  `;

  for (let i = 0; i < startWeekday; i++) {
    html += `<div class="calendar-day" style="visibility:hidden"></div>`;
  }

  const today = new Date();
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const dayNum = dayNumberFromDate(date);
    const hasRevision = calendarData[dayNum];
    const isToday = date.toDateString() === today.toDateString();

    let classes = 'calendar-day';
    if (hasRevision) classes += ' has-revision';
    if (isToday) classes += ' today';

    html += `<div class="${classes}" data-day="${dayNum}" data-date="${d}">${d}</div>`;
  }

  html += '</div>';
  return html;
}

function attachCalendarHandlers(container) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  container.querySelector('.cal-prev')?.addEventListener('click', () => {
    currentMonth = new Date(year, month - 1, 1);
    renderAll();
  });
  container.querySelector('.cal-next')?.addEventListener('click', () => {
    currentMonth = new Date(year, month + 1, 1);
    renderAll();
  });

  container.querySelectorAll('.calendar-day[data-day]').forEach(el => {
    el.addEventListener('click', () => {
      const dayNum = parseInt(el.dataset.day);
      if (dayNum < 1) return;

      container.querySelectorAll('.calendar-day.active').forEach(a => a.classList.remove('active'));

      if (calendarData[dayNum]) {
        el.classList.add('active');
        filterByDay(dayNum);
      } else {
        clearFilter();
      }
    });
  });
}

function renderDesktopCalendar() {
  const el = document.getElementById('calendarFull');
  if (!el) return;
  el.innerHTML = buildCalendarGridHTML();
  attachCalendarHandlers(el);
}

function renderCompactNav() {
  const nav = document.getElementById('dateNavCompact');
  if (!nav) return;

  const todayDayNum = dayNumberFromDate(new Date());
  let currentDay = todayDayNum;

  nav.innerHTML = `
    <button class="dn-prev">&lt;</button>
    <span class="dn-label">DAG ${currentDay}</span>
    <button class="dn-next">&gt;</button>
  `;

  const label = nav.querySelector('.dn-label');

  nav.querySelector('.dn-prev').addEventListener('click', () => {
    currentDay = Math.max(1, currentDay - 1);
    label.textContent = `DAG ${currentDay}`;
    if (calendarData[currentDay]) {
      filterByDay(currentDay);
    }
  });
  nav.querySelector('.dn-next').addEventListener('click', () => {
    currentDay = Math.min(todayDayNum, currentDay + 1);
    label.textContent = `DAG ${currentDay}`;
    if (calendarData[currentDay]) {
      filterByDay(currentDay);
    }
  });
}

function renderMobileCalendar() {
  const container = document.getElementById('mobileCalendar');
  if (!container) return;

  container.innerHTML = buildCalendarGridHTML();
  attachCalendarHandlers(container);

  // Additional mobile-specific behavior: close calendar on day click
  container.querySelectorAll('.calendar-day[data-day]').forEach(el => {
    el.addEventListener('click', () => {
      const dayNum = parseInt(el.dataset.day);
      if (dayNum < 1) return;

      // Update day toggle label
      const toggleLabel = document.getElementById('dayToggleLabel');
      if (toggleLabel) toggleLabel.textContent = `DAG ${dayNum}`;

      // Close mobile calendar
      container.classList.remove('open');
      const chevron = document.getElementById('dayChevron');
      if (chevron) chevron.style.transform = '';
    });
  });
}

function renderAll() {
  renderDesktopCalendar();
  renderCompactNav();
  renderMobileCalendar();
}

export function refreshCalendar() {
  loadCalendarData();
}

export function initCalendar(startDateStr) {
  // Parse as local date to avoid UTC offset issues
  const [y, m, d] = startDateStr.split('-').map(Number);
  startDate = new Date(y, m - 1, d);
  currentMonth = new Date();

  // Set mobile day toggle label to current day
  const todayNum = dayNumberFromDate(new Date());
  const toggleLabel = document.getElementById('dayToggleLabel');
  if (toggleLabel) toggleLabel.textContent = `DAG ${todayNum}`;

  loadCalendarData();
}
