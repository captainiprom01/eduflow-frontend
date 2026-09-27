'use strict';

/* ================= COURSES ================= */
async function addCourse(e) {
  e.preventDefault();
  const name = qs('#courseName').value.trim();
  const code = qs('#courseCode').value.trim();
  const units = parseInt(qs('#courseUnits').value, 10);
  const instructor = qs('#courseInstructor').value.trim();
  if (!name || !units) return;
  try {
    await apiFetch('/api/courses', { method: 'POST', body: JSON.stringify({ name, code, units, instructor }) });
    e.target.reset();
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
async function deleteCourse(id) {
  try {
    await apiFetch('/api/courses/' + id, { method: 'DELETE' });
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
function courseById(id) {
  return state.courses.find((c) => String(c.id) === String(id));
}
function courseActivity(courseId) {
  const key = String(courseId);
  return {
    assignments: state.assignments.filter((item) => String(item.course_id) === key),
    schedule: state.timetable.filter((item) => String(item.course_id) === key),
    grades: state.cgpaEntries.filter((item) => String(item.course_id) === key),
  };
}
function courseMatchesFilter(course) {
  const activity = courseActivity(course.id);
  if (courseFilter === 'tasks') return activity.assignments.length > 0;
  if (courseFilter === 'scheduled') return activity.schedule.length > 0;
  if (courseFilter === 'graded') return activity.grades.length > 0;
  return true;
}
function renderCourses() {
  const wrap = qs('#courseList');
  if (!state.courses.length) {
    wrap.innerHTML = emptyState('fa-book-open', 'No courses yet', 'Add your first course above to start building your timetable and CGPA.');
    return;
  }
  const query = courseSearch.toLowerCase();
  const courses = state.courses.filter((course) => {
    const text = `${course.name} ${course.code || ''} ${course.instructor || ''}`.toLowerCase();
    return text.includes(query) && courseMatchesFilter(course);
  });
  if (!courses.length) {
    wrap.innerHTML = emptyState('fa-filter', 'No matching courses', 'Try another search or choose a different filter.');
    return;
  }
  wrap.innerHTML = courses.map((c) => {
    const activity = courseActivity(c.id);
    const completed = activity.assignments.filter((item) => item.done).length;
    const progress = activity.assignments.length ? Math.round((completed / activity.assignments.length) * 100) : 0;
    const progressText = activity.assignments.length ? `${progress}%` : 'No tasks';
    return `<article class="course-list-card bg-surface dark:bg-surface-dark rounded-xl border border-ink/10 dark:border-ink-dark/10 p-4 flex items-center justify-between gap-3" onclick="openCourseDetail('${c.id}')"><div class="min-w-0 flex-1"><div class="flex items-center gap-2 min-w-0"><span class="course-card-mark"><i class="fa-solid fa-book-open"></i></span><div class="min-w-0"><p class="font-semibold truncate">${escapeHtml(c.name)} ${c.code ? `<span class="text-inksoft dark:text-inksoft-dark font-normal">· ${escapeHtml(c.code)}</span>` : ''}</p><p class="text-xs text-inksoft dark:text-inksoft-dark mt-0.5">${c.units} unit${c.units == 1 ? '' : 's'}${c.instructor ? ' · ' + escapeHtml(c.instructor) : ''}</p></div></div><div class="course-card-progress"><span>Activity progress</span><strong>${progressText}</strong><div><i style="width:${progress}%"></i></div></div></div><div class="flex items-center gap-2 shrink-0"><button aria-label="Delete course" onclick="event.stopPropagation(); deleteCourse('${c.id}')" class="w-8 h-8 rounded-lg text-coral hover:bg-coral/10 focus:outline-none focus:ring-2 focus:ring-coral"><i class="fa-solid fa-trash text-sm"></i></button><i class="course-list-arrow fa-solid fa-chevron-right"></i></div></article>`;
  }).join('');
}
function openCourseDetail(id) {
  activeCourseId = id;
  showView('course-detail');
}
function renderCourseDetail() {
  const course = courseById(activeCourseId);
  if (!course) { showView('courses'); return; }
  const activity = courseActivity(course.id);
  const completed = activity.assignments.filter((item) => item.done).length;
  const pending = activity.assignments.length - completed;
  const grades = activity.grades;
  qs('#courseDetailName').textContent = course.name;
  qs('#courseDetailMeta').textContent = [course.code, `${course.units} unit${course.units == 1 ? '' : 's'}`, course.instructor || 'Lecturer not added'].filter(Boolean).join(' · ');
  qs('#courseDetailStats').innerHTML = `<div class="course-detail-stat"><i class="fa-solid fa-list-check"></i><strong>${pending}</strong><span>Pending tasks</span></div><div class="course-detail-stat"><i class="fa-solid fa-circle-check"></i><strong>${completed}</strong><span>Completed tasks</span></div><div class="course-detail-stat"><i class="fa-solid fa-calendar-days"></i><strong>${activity.schedule.length}</strong><span>Class entries</span></div><div class="course-detail-stat"><i class="fa-solid fa-star"></i><strong>${grades.length ? escapeHtml(grades[grades.length - 1].grade) : '—'}</strong><span>Latest grade</span></div>`;
  const assignments = activity.assignments.slice().sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
  qs('#courseDetailAssignments').innerHTML = assignments.length ? assignments.map((item) => `<div class="course-detail-item"><i class="fa-solid ${item.done ? 'fa-circle-check text-teal' : 'fa-clock'}"></i><div><strong>${escapeHtml(item.title)}</strong><small>${item.done ? 'Completed' : `Due ${escapeHtml(item.due_date || 'date not set')}`}</small></div></div>`).join('') : '<p class="course-detail-empty">No assignments are linked to this course yet.</p>';
  qs('#courseDetailSchedule').innerHTML = activity.schedule.length ? activity.schedule.map((item) => `<div class="course-detail-item"><i class="fa-solid fa-calendar-day"></i><div><strong>${escapeHtml(item.day)} · ${escapeHtml(item.start_time)}–${escapeHtml(item.end_time)}</strong><small>${escapeHtml(item.location || 'Location not added')}</small></div></div>`).join('') : '<p class="course-detail-empty">No timetable entries are linked to this course yet.</p>';
  qs('#courseDetailGrades').innerHTML = grades.length ? grades.map((item) => { const semester = state.semesters.find((s) => String(s.id) === String(item.semester_id)); return `<div class="course-detail-item"><i class="fa-solid fa-award"></i><div><strong>${escapeHtml(item.grade)}</strong><small>${escapeHtml(semester ? semester.name : 'Semester')}</small></div></div>`; }).join('') : '<p class="course-detail-empty">No grade has been recorded for this course yet.</p>';
}
function populateCourseSelects() {
  const options = state.courses.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}${c.code ? ' (' + escapeHtml(c.code) + ')' : ''}</option>`).join('');
  const hasCourses = state.courses.length > 0;

  qs('#ttCourse').innerHTML = hasCourses ? options : '<option value="">Add a course first</option>';
  qs('#cgpaCourse').innerHTML = hasCourses ? options : '<option value="">Add a course first</option>';
  qs('#asgCourse').innerHTML = '<option value="">General</option>' + options;

  qs('#timetableEmptyCourses').classList.toggle('hidden', hasCourses);
  qs('#cgpaEmptyCourses').classList.toggle('hidden', hasCourses);
  qs('#timetableForm').querySelectorAll('input,select,button').forEach((el) => { el.disabled = !hasCourses; });
  qs('#cgpaCourse').disabled = !hasCourses;
  qs('#cgpaForm').querySelector('button[type="submit"]').disabled = !hasCourses || !state.semesters.length;
}

