import { filterByDay, clearFilter } from './journal.js';

let calendarData = {};
let currentMonth = new Date();
let widget;
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
      renderCalendar();
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

function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleString('sv-SE', { month: 'short', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  let html = `
    <div class="calendar-header">
      <button id="calPrev">&lt;</button>
      <span>${monthName.toUpperCase()}</span>
      <button id="calNext">&gt;</button>
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
  widget.innerHTML = html;

  widget.querySelector('#calPrev').addEventListener('click', () => {
    currentMonth = new Date(year, month - 1, 1);
    renderCalendar();
  });
  widget.querySelector('#calNext').addEventListener('click', () => {
    currentMonth = new Date(year, month + 1, 1);
    renderCalendar();
  });

  widget.querySelectorAll('.calendar-day[data-day]').forEach(el => {
    el.addEventListener('click', () => {
      const dayNum = parseInt(el.dataset.day);
      if (dayNum < 1) return;

      widget.querySelectorAll('.calendar-day.active').forEach(a => a.classList.remove('active'));

      if (calendarData[dayNum]) {
        el.classList.add('active');
        filterByDay(dayNum);
      } else {
        clearFilter();
      }
    });
  });
}

export function refreshCalendar() {
  loadCalendarData();
}

export function initCalendar(startDateStr) {
  widget = document.getElementById('calendarWidget');
  startDate = new Date(startDateStr);
  currentMonth = new Date();
  loadCalendarData();
}
