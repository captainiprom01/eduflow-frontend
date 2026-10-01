'use strict';

/* ================= TIMETABLE ================= */
async function addClass(e) {
  e.preventDefault();
  const courseId = qs('#ttCourse').value;
  const day = qs('#ttDay').value;
  const start = qs('#ttStart').value;
  const end = qs('#ttEnd').value;
  const location = qs('#ttLocation').value.trim();
  if (!courseId || !day || !start || !end) return;
  try {
    await apiMutate('/api/timetable', { method: 'POST', body: JSON.stringify({ courseId, day, startTime: start, endTime: end, location }) });
    e.target.reset();
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
async function deleteClass(id) {
  try {
    await apiMutate('/api/timetable/' + id, { method: 'DELETE' });
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
function classLabel(entry) {
  const title = entry.course_name || 'Unknown course';
  return `
    <div class="bg-paper dark:bg-paper-dark rounded-lg p-3 flex items-center justify-between gap-3 border border-ink/5 dark:border-ink-dark/5">
      <div class="min-w-0">
        <p class="font-semibold text-sm truncate">${escapeHtml(title)}</p>
        <p class="text-xs text-inksoft dark:text-inksoft-dark mt-0.5">${entry.start_time}–${entry.end_time}${entry.location ? ' · ' + escapeHtml(entry.location) : ''}</p>
      </div>
      <button aria-label="Delete class" onclick="deleteClass('${entry.id}')" class="w-7 h-7 shrink-0 rounded-lg text-coral hover:bg-coral/10 focus:outline-none focus:ring-2 focus:ring-coral">
        <i class="fa-solid fa-trash text-xs"></i>
      </button>
    </div>
  `;
}
function renderTimetable() {
  const todayName = DAYS[new Date().getDay()];
  qs('#ttTodayName').textContent = todayName;

  const todays = state.timetable.filter((t) => t.day === todayName).sort((a, b) => a.start_time.localeCompare(b.start_time));
  qs('#ttToday').innerHTML = todays.length
    ? todays.map(classLabel).join('')
    : emptyState('fa-mug-hot', 'No classes today', 'Enjoy the free time, or get ahead on an assignment.');

  qs('#ttWeek').innerHTML = WEEK_DAYS.map((day) => {
    const entries = state.timetable.filter((t) => t.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
    return `
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-inksoft dark:text-inksoft-dark mb-2">${day}${day === todayName ? ' <span class="text-teal">· today</span>' : ''}</p>
        ${entries.length ? `<div class="space-y-2">${entries.map(classLabel).join('')}</div>` : `<p class="text-sm text-inksoft dark:text-inksoft-dark">No classes scheduled.</p>`}
      </div>
    `;
  }).join('');
}
