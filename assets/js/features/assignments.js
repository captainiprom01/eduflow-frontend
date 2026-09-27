'use strict';

/* ================= ASSIGNMENTS ================= */
let assignmentFilter = 'all';
async function addAssignment(e) {
  e.preventDefault();
  const title = qs('#asgTitle').value.trim();
  const courseId = qs('#asgCourse').value || null;
  const due = qs('#asgDue').value;
  const priority = qs('#asgPriority').value;
  if (!title || !due) return;
  try {
    await apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify({ title, courseId, dueDate: due, priority }) });
    e.target.reset();
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
async function toggleAssignment(id, currentlyDone) {
  try {
    await apiFetch('/api/assignments/' + id, { method: 'PATCH', body: JSON.stringify({ done: !currentlyDone }) });
    if (!currentlyDone) { celebrate(); await recordStudyActivity('assignment_completed'); }
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
async function deleteAssignment(id) {
  try {
    await apiFetch('/api/assignments/' + id, { method: 'DELETE' });
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
function daysUntil(dateStr) {
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}
function dueLabel(dateStr, done) {
  const d = daysUntil(dateStr);
  if (done) return { text: 'Completed', cls: 'text-teal' };
  if (d < 0) return { text: `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} overdue`, cls: 'text-coral font-semibold' };
  if (d === 0) return { text: 'Due today', cls: 'text-amber font-semibold' };
  if (d === 1) return { text: 'Due tomorrow', cls: 'text-amber' };
  return { text: `Due in ${d} days`, cls: 'text-inksoft dark:text-inksoft-dark' };
}
function renderAssignments() {
  qsa('.asg-filter-btn').forEach((b) => {
    const active = b.dataset.filter === assignmentFilter;
    b.classList.toggle('bg-teal', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('bg-ink/5', !active);
    b.classList.toggle('dark:bg-white/5', !active);
    b.classList.toggle('text-inksoft', !active);
    b.classList.toggle('dark:text-inksoft-dark', !active);
  });

  let list = [...state.assignments];
  if (assignmentFilter === 'pending') list = list.filter((a) => !a.done);
  if (assignmentFilter === 'done') list = list.filter((a) => a.done);
  list.sort((a, b) => a.due_date.localeCompare(b.due_date));

  const wrap = qs('#assignmentList');
  if (!list.length) {
    wrap.innerHTML = emptyState('fa-list-check', 'Nothing here', 'Add an assignment above to start tracking it.');
    return;
  }
  wrap.innerHTML = list.map((a) => {
    const due = dueLabel(a.due_date, a.done);
    return `
      <div class="bg-surface dark:bg-surface-dark rounded-xl border border-ink/10 dark:border-ink-dark/10 p-4 flex items-start gap-3 ${a.priority === 'high' && !a.done ? 'border-l-4 border-l-coral' : ''}">
        <button aria-label="${a.done ? 'Mark as pending' : 'Mark as complete'}" onclick="toggleAssignment('${a.id}', ${a.done})" class="mt-0.5 w-6 h-6 shrink-0 rounded-full border-2 ${a.done ? 'bg-teal border-teal' : 'border-ink/30 dark:border-ink-dark/30'} flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-teal">
          ${a.done ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : ''}
        </button>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-sm ${a.done ? 'line-through text-inksoft dark:text-inksoft-dark' : ''} truncate">${escapeHtml(a.title)}</p>
          <p class="text-xs text-inksoft dark:text-inksoft-dark mt-0.5">${a.course_name ? escapeHtml(a.course_name) + ' · ' : ''}${a.due_date}</p>
          <p class="text-xs mt-1 ${due.cls}">${due.text}</p>
        </div>
        <button aria-label="Delete assignment" onclick="deleteAssignment('${a.id}')" class="w-8 h-8 shrink-0 rounded-lg text-coral hover:bg-coral/10 focus:outline-none focus:ring-2 focus:ring-coral">
          <i class="fa-solid fa-trash text-sm"></i>
        </button>
      </div>
    `;
  }).join('');
}
function initAssignmentFilters() {
  qsa('.asg-filter-btn').forEach((b) => {
    b.addEventListener('click', () => { assignmentFilter = b.dataset.filter; renderAssignments(); });
  });
}

