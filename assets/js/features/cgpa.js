'use strict';

/* ================= SEMESTERS + CGPA ================= */
/* Note: no grade-point table or classification logic here on purpose —
   the server computes gpa/cumulative/classification and this file just
   displays state.semesters / state.cumulative as returned. */
async function addSemester(e) {
  e.preventDefault();
  const input = e.target.id === 'courseSemesterForm' ? qs('#courseSemesterName') : qs('#semesterName');
  const name = input.value.trim();
  if (!name) return;
  try {
    const data = await apiFetch('/api/semesters', { method: 'POST', body: JSON.stringify({ name }) });
    e.target.reset();
    activeSemesterId = data.semester.id;
    const savedSemester = Object.assign({ gpa: 0, units: 0 }, data.semester);
    state.semesters = state.semesters.filter((semester) => String(semester.id) !== String(savedSemester.id));
    state.semesters.push(savedSemester);
    renderAllViews();
    showToast('Semester saved.');
  } catch (err) { showToast(err.message); }
}
async function deleteSemester(id) {
  const semester = state.semesters.find((s) => String(s.id) === String(id));
  const gradeCount = state.cgpaEntries.filter((en) => String(en.semester_id) === String(id)).length;
  if (gradeCount > 0) {
    const ok = window.confirm(`Delete "${semester ? semester.name : 'this semester'}" and its ${gradeCount} grade${gradeCount === 1 ? '' : 's'}?`);
    if (!ok) return;
  }
  try {
    await apiFetch('/api/semesters/' + id, { method: 'DELETE' });
    if (String(activeSemesterId) === String(id)) activeSemesterId = null;
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
function selectSemester(id) {
  activeSemesterId = id;
  renderCgpa();
}
async function addCgpaEntry(e) {
  e.preventDefault();
  const courseId = qs('#cgpaCourse').value;
  const grade = qs('#cgpaGrade').value;
  if (!courseId || !grade || !activeSemesterId) return;
  try {
    await apiFetch('/api/cgpa', { method: 'POST', body: JSON.stringify({ semesterId: activeSemesterId, courseId, grade }) });
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
async function deleteCgpaEntry(id) {
  try {
    await apiFetch('/api/cgpa/' + id, { method: 'DELETE' });
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
function renderCgpa() {
  const hasSemesters = state.semesters.length > 0;
  qs('#cgpaEmptySemesters').classList.toggle('hidden', hasSemesters);
  qs('#cgpaForm').querySelectorAll('select,button').forEach((el) => { el.disabled = !hasSemesters || !state.courses.length; });

  qs('#semesterPills').innerHTML = state.semesters.map((s) => {
    const active = String(s.id) === String(activeSemesterId);
    return `
      <span class="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-semibold border ${active ? 'bg-teal text-white border-teal' : 'bg-paper dark:bg-paper-dark border-ink/10 dark:border-ink-dark/10 text-inksoft dark:text-inksoft-dark'}">
        <button onclick="selectSemester('${s.id}')" class="focus:outline-none">${escapeHtml(s.name)} · ${s.gpa.toFixed(2)}</button>
        <button aria-label="Delete semester" onclick="deleteSemester('${s.id}')" class="w-5 h-5 rounded-full flex items-center justify-center ${active ? 'hover:bg-white/20' : 'hover:bg-coral/10 text-coral'}">
          <i class="fa-solid fa-xmark text-[10px]"></i>
        </button>
      </span>
    `;
  }).join('') || '<p class="text-sm text-inksoft dark:text-inksoft-dark">No semesters yet — add one above.</p>';
  const courseSemesterList = qs('#courseSemesterList');
  if (courseSemesterList) {
    courseSemesterList.innerHTML = state.semesters.length
      ? state.semesters.map((s) => `<div class="flex items-center justify-between gap-3 rounded-xl border border-ink/10 dark:border-ink-dark/10 bg-paper dark:bg-paper-dark px-3 py-2.5"><span class="min-w-0 truncate text-sm font-semibold">${escapeHtml(s.name)}</span><button type="button" onclick="deleteSemester('${s.id}')" class="w-7 h-7 shrink-0 rounded-lg text-coral hover:bg-coral/10" aria-label="Delete semester"><i class="fa-solid fa-trash text-xs"></i></button></div>`).join('')
      : '<p class="text-xs text-inksoft dark:text-inksoft-dark">No semesters yet. Add your first one above.</p>';
  }

  const cum = state.cumulative;
  qs('#cgpaValue').textContent = cum.gpa.toFixed(2);
  qs('#cgpaClass').textContent = cum.classification;
  qs('#cgpaUnits').textContent = `${cum.units} unit${cum.units === 1 ? '' : 's'} logged`;

  const activeSemester = state.semesters.find((s) => String(s.id) === String(activeSemesterId));
  qs('#semesterGpaValue').textContent = activeSemester ? activeSemester.gpa.toFixed(2) : '0.00';
  qs('#semesterGpaUnits').textContent = activeSemester ? `${activeSemester.units} unit${activeSemester.units === 1 ? '' : 's'}` : '0 units';
  qs('#cgpaLogSemesterName').textContent = activeSemester ? `— ${activeSemester.name}` : '';

  const entries = state.cgpaEntries.filter((en) => String(en.semester_id) === String(activeSemesterId));
  const listWrap = qs('#cgpaList');
  if (!activeSemester) {
    listWrap.innerHTML = emptyState('fa-calculator', 'No semester selected', 'Add a semester above to start logging grades.');
  } else if (!entries.length) {
    listWrap.innerHTML = emptyState('fa-calculator', 'No grades logged', 'Choose a course and grade above to add one to this semester.');
  } else {
    listWrap.innerHTML = entries.map((en) => `
      <div class="bg-paper dark:bg-paper-dark rounded-lg p-3 flex items-center justify-between gap-3 border border-ink/5 dark:border-ink-dark/5">
        <div class="min-w-0">
          <p class="font-semibold text-sm truncate">${escapeHtml(en.course_name)}</p>
          <p class="text-xs text-inksoft dark:text-inksoft-dark mt-0.5">${en.units} units · grade ${en.grade}</p>
        </div>
        <button aria-label="Delete grade" onclick="deleteCgpaEntry('${en.id}')" class="w-7 h-7 shrink-0 rounded-lg text-coral hover:bg-coral/10 focus:outline-none focus:ring-2 focus:ring-coral">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      </div>
    `).join('');
  }

  qs('#semesterSummaryList').innerHTML = state.semesters.length
    ? state.semesters.map((s) => `
        <div class="bg-paper dark:bg-paper-dark rounded-lg p-3 flex items-center justify-between gap-3 border border-ink/5 dark:border-ink-dark/5">
          <p class="font-semibold text-sm">${escapeHtml(s.name)}</p>
          <p class="text-sm font-semibold">${s.gpa.toFixed(2)} <span class="text-xs font-normal text-inksoft dark:text-inksoft-dark">(${s.units} units)</span></p>
        </div>
      `).join('')
    : emptyState('fa-layer-group', 'No semesters yet', 'Add your first semester above.');
}

