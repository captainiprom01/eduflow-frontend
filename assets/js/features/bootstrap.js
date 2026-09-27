'use strict';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The device's own calendar date (not UTC) — sent with the streak check-in
// so someone in a timezone ahead of UTC doesn't get an incorrect reset
// just because the server's clock hasn't reached "tomorrow" yet.
function localDateStr() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
const STUDY_ACTIVITY_QUEUE_KEY = 'eduflow_pending_study_activity';
function readPendingStudyActivity() {
  try { return JSON.parse(localStorage.getItem(STUDY_ACTIVITY_QUEUE_KEY) || '[]'); } catch (error) { return []; }
}
function writePendingStudyActivity(items) {
  try { localStorage.setItem(STUDY_ACTIVITY_QUEUE_KEY, JSON.stringify(items.slice(-20))); } catch (error) { /* storage is optional */ }
  renderOfflineSyncStatus();
}
function renderOfflineSyncStatus() {
  const status = qs('#offlineSyncStatus');
  if (!status) return;
  const count = readPendingStudyActivity().length;
  status.textContent = count ? `${count} study update${count === 1 ? '' : 's'} waiting to sync.` : (navigator.onLine ? 'Activity synced.' : 'You are offline. Completed sessions will sync later.');
}
async function flushPendingStudyActivity() {
  if (!authToken || !navigator.onLine) return;
  const pending = readPendingStudyActivity();
  if (!pending.length) return renderOfflineSyncStatus();
  const remaining = [];
  for (const item of pending) {
    try { await apiFetch('/api/streak/activity', { method: 'POST', body: JSON.stringify(item) }); }
    catch (error) { remaining.push(item); }
  }
  writePendingStudyActivity(remaining);
}
function queueStudyActivity(source) {
  const pending = readPendingStudyActivity();
  pending.push({ source, localDate: localDateStr() });
  writePendingStudyActivity(pending);
}
async function recordStudyActivity(source) {
  try {
    const data = await apiFetch('/api/streak/activity', { method: 'POST', body: JSON.stringify({ source, localDate: localDateStr() }) });
    if (state.streak) {
      state.streak = { ...state.streak, currentStreak: data.currentStreak, longestStreak: data.longestStreak };
      renderStreak();
      renderLevel();
      renderAssistantInsights();
    }
    await flushPendingStudyActivity();
  } catch (error) {
    queueStudyActivity(source);
  }
}

const focusTimerState = { mode: 'focus', remaining: 25 * 60, running: false, interval: null, completedSessions: Number(localStorage.getItem('eduflow_focus_sessions') || 0) };
function renderFocusTimer() {
  const timer = qs('#focusTimer');
  const status = qs('#focusStatus');
  const modeLabel = qs('#focusModeLabel');
  const start = qs('#focusStartBtn');
  if (!timer || !status || !modeLabel || !start) return;
  const minutes = Math.floor(focusTimerState.remaining / 60).toString().padStart(2, '0');
  const seconds = (focusTimerState.remaining % 60).toString().padStart(2, '0');
  timer.textContent = `${minutes}:${seconds}`;
  modeLabel.textContent = focusTimerState.mode === 'focus' ? 'Focus session' : 'Short break';
  start.textContent = focusTimerState.running ? 'Pause' : focusTimerState.remaining === (focusTimerState.mode === 'focus' ? 25 * 60 : 5 * 60) ? 'Start' : 'Resume';
  status.textContent = focusTimerState.running ? (focusTimerState.mode === 'focus' ? 'Stay with one task until the timer ends.' : 'Take a short break, then come back refreshed.') : `${focusTimerState.completedSessions} focus session${focusTimerState.completedSessions === 1 ? '' : 's'} completed on this device.`;
}
function resetFocusTimer() {
  if (focusTimerState.interval) clearInterval(focusTimerState.interval);
  focusTimerState.interval = null;
  focusTimerState.running = false;
  focusTimerState.mode = 'focus';
  focusTimerState.remaining = 25 * 60;
  renderFocusTimer();
}
async function completeFocusPhase() {
  if (focusTimerState.interval) clearInterval(focusTimerState.interval);
  focusTimerState.interval = null;
  focusTimerState.running = false;
  if (focusTimerState.mode === 'focus') {
    focusTimerState.completedSessions += 1;
    localStorage.setItem('eduflow_focus_sessions', String(focusTimerState.completedSessions));
    await recordStudyActivity('focus_session');
    showToast('Focus session complete. Great work — take a short break.');
    focusTimerState.mode = 'break';
    focusTimerState.remaining = 5 * 60;
  } else {
    showToast('Break complete. Ready for another focused session?');
    focusTimerState.mode = 'focus';
    focusTimerState.remaining = 25 * 60;
  }
  renderFocusTimer();
}
function toggleFocusTimer() {
  if (focusTimerState.running) {
    clearInterval(focusTimerState.interval);
    focusTimerState.interval = null;
    focusTimerState.running = false;
    renderFocusTimer();
    return;
  }
  focusTimerState.running = true;
  focusTimerState.interval = setInterval(() => {
    focusTimerState.remaining -= 1;
    if (focusTimerState.remaining <= 0) completeFocusPhase();
    else renderFocusTimer();
  }, 1000);
  renderFocusTimer();
}
function renderFocusCourseOptions() {
  const select = qs('#focusCourse');
  if (!select) return;
  const selected = select.value;
  select.innerHTML = '<option value="">General study</option>' + state.courses.map((course) => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.name)}${course.code ? ` · ${escapeHtml(course.code)}` : ''}</option>`).join('');
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

let dailyRefreshTimer = null;
function scheduleDailyRefresh() {
  if (dailyRefreshTimer) clearTimeout(dailyRefreshTimer);
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 250);
  dailyRefreshTimer = setTimeout(async () => {
    if (authToken && currentUser) {
      renderQuoteOfTheDay();
      await reloadAll();
      await loadDailyQuote();
      await loadAnnouncements();
    }
    scheduleDailyRefresh();
  }, Math.max(1000, nextMidnight.getTime() - Date.now()));
}

async function reloadAll() {
  const results = await Promise.allSettled([
    apiFetch('/api/courses'),
    apiFetch('/api/cgpa'),
    apiFetch('/api/semesters'),
    apiFetch('/api/timetable'),
    apiFetch('/api/assignments'),
    apiFetch('/api/tasks'),
    apiFetch('/api/progress'),
    apiFetch('/api/streak?localDate=' + localDateStr()),
  ]);
  const [coursesRes, cgpaRes, semRes, ttRes, asgRes, taskRes, progRes, streakRes] = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  const anyFailed = results.some((r) => r.status === 'rejected');
  const anySessionExpired = results.some((r) => r.status === 'rejected' && r.reason && r.reason.message === 'SESSION_EXPIRED');

  if (anySessionExpired) {
    // Keep the authenticated shell and local session intact. A single
    // background endpoint must not destroy the user's session or hide data
    // they have already saved. The next explicit API action will surface the
    // server response if the token genuinely needs attention.
    showDeterrentToast('Some data could not be refreshed, but your session is still active.');
    return;
  }

  state.courses = (coursesRes && coursesRes.courses) || state.courses || [];
  state.cgpaEntries = (cgpaRes && cgpaRes.entries) || state.cgpaEntries || [];
  state.semesters = (cgpaRes && cgpaRes.semesters) || state.semesters || [];
  state.cumulative = (cgpaRes && cgpaRes.cumulative) || state.cumulative || null;
  state.timetable = (ttRes && ttRes.timetable) || state.timetable || [];
  state.assignments = (asgRes && asgRes.assignments) || state.assignments || [];
  state.tasks = (taskRes && taskRes.tasks) || state.tasks || [];
  state.progress = progRes || state.progress || null;
  state.streak = streakRes || state.streak || null;

  if (!activeSemesterId || !state.semesters.some((s) => String(s.id) === String(activeSemesterId))) {
    activeSemesterId = state.semesters.length ? state.semesters[state.semesters.length - 1].id : null;
  }
  renderAllViews();
  if (anyFailed) {
    showDeterrentToast("Some data didn't load — the server may still be waking up. Try refreshing in a few seconds.");
  }
}
function renderAllViews() {
  populateCourseSelects();
  renderFocusCourseOptions();
  renderFocusTimer();
  renderCourses();
  renderTimetable();
  renderAssignments();
  renderCgpa();
  renderProgress();
  renderOverview();
  renderProfile();
}

async function bootApp() {
  showApp();
  qs('#sidebarUserName').textContent = currentUser ? currentUser.name : 'Student';
  qs('#sidebarUserEmail').textContent = currentUser ? currentUser.email : '';
  qs('#verifyBanner').classList.toggle('hidden', !currentUser || currentUser.email_verified !== false);
  await reloadAll();
  await flushPendingStudyActivity();
  // The overview is usable once the primary academic data has loaded. Keep
  // announcements, preferences, conversations, and assistant metadata from
  // delaying the first meaningful render on a cold or waking server.
  showView('overview');
  scheduleDailyRefresh();
  initMessageSocket();
  renderChat();
  void Promise.allSettled([
    loadDailyQuote(),
    loadAnnouncements(),
    loadPreferences(),
    loadConversations(),
    initAssistantModels(),
  ]);
}
async function tryResumeSession() {
  if (!authToken) { showAuthScreen(); return; }
  try {
    const data = await apiFetch('/api/auth/me');
    currentUser = data.user;
    localStorage.setItem('eduflow_user', JSON.stringify(currentUser));
    await bootApp();
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') {
      logout();
      showAuthError('Your session expired. Please log in again.');
    } else if (currentUser) {
      await bootApp();
      showDeterrentToast('The server is reconnecting. Your saved session is still available.');
    } else {
      showAuthScreen();
    }
  }
}

