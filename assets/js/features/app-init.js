'use strict';

/* ================= INIT ================= */
function pollForGoogleSignIn(attemptsLeft) {
  if (typeof google !== 'undefined' && google.accounts) {
    initGoogleSignIn();
    return;
  }
  if (attemptsLeft <= 0) return;
  setTimeout(() => pollForGoogleSignIn(attemptsLeft - 1), 300);
}

/* ---------- PWA: install prompt + service worker ---------- */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.classList.add('hidden');
});
/* ---------- global search ---------- */
function runGlobalSearch(rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];
  const results = [];

  state.courses.forEach((c) => {
    if (c.name.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q))) {
      results.push({ icon: 'fa-book-open', title: c.name, subtitle: c.code || `${c.units} units`, view: 'courses' });
    }
  });
  state.assignments.forEach((a) => {
    if (a.title.toLowerCase().includes(q)) {
      results.push({ icon: 'fa-list-check', title: a.title, subtitle: a.done ? 'Completed' : `Due ${a.due_date}`, view: 'assignments' });
    }
  });
  state.timetable.forEach((t) => {
    const course = t.course_name || '';
    if (course.toLowerCase().includes(q) || (t.location && t.location.toLowerCase().includes(q))) {
      results.push({ icon: 'fa-calendar-week', title: course || 'Class', subtitle: `${t.day} · ${t.start_time}${t.location ? ' · ' + t.location : ''}`, view: 'timetable' });
    }
  });
  state.tasks.forEach((task) => {
    if (task.text.toLowerCase().includes(q)) {
      results.push({ icon: 'fa-chart-line', title: task.text, subtitle: task.done ? 'Completed' : 'Study task', view: 'progress' });
    }
  });

  return results.slice(0, 8);
}
function renderSearchResults(results, query) {
  const wrap = qs('#globalSearchResults');
  if (!query.trim()) {
    wrap.classList.add('hidden');
    wrap.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  wrap.innerHTML = results.length
    ? results.map((r) => `
        <button data-search-view="${r.view}" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-ink/5 dark:hover:bg-white/5 border-b border-ink/5 dark:border-ink-dark/5 last:border-b-0">
          <i class="fa-solid ${r.icon} text-xs text-inksoft dark:text-inksoft-dark w-4 text-center shrink-0"></i>
          <span class="min-w-0">
            <span class="block text-sm font-medium truncate">${escapeHtml(r.title)}</span>
            <span class="block text-xs text-inksoft dark:text-inksoft-dark truncate">${escapeHtml(r.subtitle)}</span>
          </span>
        </button>
      `).join('')
    : `<p class="px-3 py-3 text-sm text-inksoft dark:text-inksoft-dark">No matches for "${escapeHtml(query)}"</p>`;
}
function initGlobalSearch() {
  const input = qs('#globalSearchInput');
  const wrap = qs('#globalSearchResults');
  input.addEventListener('input', () => {
    renderSearchResults(runGlobalSearch(input.value), input.value);
  });
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-search-view]');
    if (!btn) return;
    showView(btn.dataset.searchView);
    input.value = '';
    wrap.classList.add('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#globalSearchInput') && !e.target.closest('#globalSearchResults')) {
      wrap.classList.add('hidden');
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.value = ''; wrap.classList.add('hidden'); input.blur(); }
  });
}

/* ---------- floating assistant button + one-time welcome bubble ---------- */
function initFloatingAssistant() {
  const btn = qs('#floatingAssistantBtn');
  const bubble = qs('#assistantWelcomeBubble');

  function dismissBubble() {
    bubble.classList.add('hidden');
    localStorage.setItem('eduflow_seen_assistant_welcome', '1');
  }

  if (!localStorage.getItem('eduflow_seen_assistant_welcome')) {
    setTimeout(() => bubble.classList.remove('hidden'), 1200);
  }
  bubble.addEventListener('click', () => {
    dismissBubble();
    showView('assistant');
  });
  qs('#dismissAssistantWelcomeBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    dismissBubble();
  });
  btn.addEventListener('click', dismissBubble);
}

function initInstallPrompt() {
  const btn = qs('#installAppBtn');
  btn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btn.classList.add('hidden');
  });
}
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline caching just won't be available — app still works online */ });
  });
}
const firstRunSlides = [
  { theme: 'ai', accent: '#2563eb', title: 'Your Intelligent\nCampus Companion', description: 'EduFlow brings your academic life together — courses, assignments, timetable, and an AI assistant that helps you study smarter.', illustration: '<div class="onboarding-card"><span class="onboarding-card-icon" style="background:#2563eb"><i class="fa-solid fa-brain"></i></span><span class="onboarding-card-copy"><strong>Ask EduAI anything</strong><span>Powered by your academic context</span></span></div><div class="onboarding-card"><span class="onboarding-card-icon" style="background:#7c3aed"><i class="fa-solid fa-wand-magic-sparkles"></i></span><span class="onboarding-card-copy"><strong>Personalised study help</strong><span>Plans, explanations and quick answers</span></span></div><div class="onboarding-card"><span class="onboarding-card-icon" style="background:#059669"><i class="fa-solid fa-chart-line"></i></span><span class="onboarding-card-copy"><strong>Track your progress</strong><span>See your semester at a glance</span></span></div>' },
  { theme: 'schedule', accent: '#f59e0b', title: 'Never Miss a\nDeadline Again', description: 'Keep your timetable, assignments, and important academic dates organised in one clear view — so you always know what is next.', illustration: '<div class="onboarding-calendar"><div class="onboarding-calendar-head"><span>THIS WEEK</span><i class="fa-solid fa-calendar-days"></i></div><div class="onboarding-calendar-grid"><i>Mon</i><i>Tue</i><i class="active">Wed</i><i>Thu</i><i>Fri</i><i>9:00</i><i></i><i class="active">CSC</i><i></i><i></i></div><div class="onboarding-calendar-event"><b><i class="fa-solid fa-clock"></i></b><span>Database Lab · 10:00 AM</span></div></div>' },
  { theme: 'campus', accent: '#059669', title: 'Campus Information\n& Communication', description: 'Stay connected with official announcements, message classmates and lecturers, and access all campus services — all in one intelligent app.', illustration: '<div class="onboarding-card"><span class="onboarding-card-icon" style="background:#2563eb">📢</span><span class="onboarding-card-copy"><strong>Exam Schedule Released</strong><span>Examinations Office · 2h ago</span></span></div><div class="onboarding-card"><span class="onboarding-card-icon" style="background:#7c3aed">💬</span><span class="onboarding-card-copy"><strong>Chidi: Did you finish the assignment?</strong><span>CSC 300 Level Group</span></span></div><div class="onboarding-card"><span class="onboarding-card-icon" style="background:#059669">🎓</span><span class="onboarding-card-copy"><strong>New grade: CSC 301 — A</strong><span>Score: 87/100 · Just now</span></span></div>' }
];
let firstRunIndex = 0;
function hideFirstRun() {
  qs('#firstRunSplash').classList.add('hidden');
  qs('#firstRunOnboarding').classList.add('hidden');
}
function renderFirstRunSlide() {
  const slide = firstRunSlides[firstRunIndex];
  const art = qs('#onboardingArt');
  art.className = 'onboarding-art ' + slide.theme;
  qs('#onboardingIllustration').innerHTML = slide.illustration;
  qs('#onboardingTitle').textContent = slide.title;
  qs('#onboardingDescription').textContent = slide.description;
  qs('#onboardingNext').className = 'onboarding-next ' + slide.theme + '-next';
  qs('#onboardingNext span').textContent = firstRunIndex === firstRunSlides.length - 1 ? 'Get Started' : 'Continue';
  qs('#onboardingDots').innerHTML = firstRunSlides.map((item, i) => `<button type="button" aria-label="Go to slide ${i + 1}" class="${i === firstRunIndex ? 'active ' + item.theme + '-dot' : ''}"></button>`).join('');
  qsa('#onboardingDots button').forEach((button, i) => button.addEventListener('click', () => { firstRunIndex = i; renderFirstRunSlide(); }));
}
function finishFirstRun() {
  localStorage.setItem('eduflow_onboarding_seen', '1');
  hideFirstRun();
  showAuthScreen();
}
function startFirstRun() {
  if (authToken) { hideFirstRun(); return; }
  if (localStorage.getItem('eduflow_onboarding_seen')) { hideFirstRun(); showAuthScreen(); return; }
  qs('#firstRunSplash').classList.remove('hidden');
  qs('#firstRunOnboarding').classList.add('hidden');
  setTimeout(() => { qs('#firstRunSplash').classList.add('hidden'); qs('#firstRunOnboarding').classList.remove('hidden'); renderFirstRunSlide(); }, 2600);
  qs('#onboardingSkip').onclick = finishFirstRun;
  qs('#onboardingNext').onclick = () => { if (firstRunIndex < firstRunSlides.length - 1) { firstRunIndex += 1; renderFirstRunSlide(); } else finishFirstRun(); };
}
function init() {
  initTheme();
  registerServiceWorker();
  initInstallPrompt();
  initGlobalSearch();
  initMobileNotifications();
  initFloatingAssistant();

  qsa('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = qs('#' + btn.dataset.togglePassword);
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.querySelector('i').className = showing ? 'fa-solid fa-eye text-sm' : 'fa-solid fa-eye-slash text-sm';
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });

  // A password-reset link looks like index.html?resetToken=xxxx — if that's
  // how the page was opened, show only the "set new password" screen and
  // skip the normal login flow entirely.
  const resetToken = new URLSearchParams(window.location.search).get('resetToken');
  if (resetToken) {
    hideFirstRun();
    qs('#resetPasswordScreen').classList.remove('hidden');
    qs('#resetPasswordForm').addEventListener('submit', handleResetPassword);
    return;
  }

  // Same idea for an email-verification link: index.html?verifyToken=xxxx
  const verifyToken = new URLSearchParams(window.location.search).get('verifyToken');
  if (verifyToken) {
    hideFirstRun();
    qs('#verifyEmailScreen').classList.remove('hidden');
    runEmailVerification(verifyToken);
    return;
  }

  initNav();
  startFirstRun();
  qsa('[data-open-semester]').forEach((btn) => btn.addEventListener('click', () => setTimeout(() => qs('#courseSemesterName')?.focus(), 0)));
  initAssignmentFilters();

  qs('#authTabLogin').addEventListener('click', () => setAuthTab('login'));
  qs('#authTabSignup').addEventListener('click', () => setAuthTab('signup'));
  setAuthTab('login');
  qs('#loginForm').addEventListener('submit', handleLogin);
  qs('#signupForm').addEventListener('submit', handleSignup);
  qs('#forgotForm').addEventListener('submit', handleForgotPassword);
  qs('#showForgotFormBtn').addEventListener('click', showForgotForm);
  qs('#backToLoginBtn').addEventListener('click', backToLogin);
  pollForGoogleSignIn(15);
  qs('#logoutBtn').addEventListener('click', logout);
  qs('#accountNameForm').addEventListener('submit', handleUpdateName);
  qs('#profileDetailsForm').addEventListener('submit', handleProfileDetails);
  qs('#profileUpdateBtn').addEventListener('click', openProfileEditor);
  qs('#profileCancelBtn').addEventListener('click', cancelProfileEditor);
  qs('#messagesComposeBtn').addEventListener('click', () => { qs('#messagesComposePanel').classList.remove('hidden'); loadMessageContacts(); });
  qs('#messagesComposeCloseBtn').addEventListener('click', () => qs('#messagesComposePanel').classList.add('hidden'));
  qs('#messagesDirectModeBtn').addEventListener('click', () => setMessageComposeMode(false));
  qs('#messagesGroupModeBtn').addEventListener('click', () => setMessageComposeMode(true));
  qs('#messagesGroupForm').addEventListener('submit', createGroupConversation);
  qs('#messagesBackBtn').addEventListener('click', () => { messageState.activeId = null; messageState.activeMessages = []; qs('#messagesThreadPanel').classList.add('hidden'); qs('#messagesListPanel').classList.remove('hidden'); loadConversations(); });
  qs('#messagesSearch').addEventListener('input', (e) => { messageState.search = e.target.value; renderMessagesList(); });
  qs('#messagesContactSearch').addEventListener('input', (e) => { messageState.contactSearch = e.target.value; renderMessageContacts(); });
  qs('#messagesSendForm').addEventListener('submit', sendMessage);
  qsa('[data-preference]').forEach((input) => input.addEventListener('change', () => savePreference(input.dataset.preference, input.checked)));
  qs('#settingsReminderTime').addEventListener('change', (e) => savePreference('reminder_time', e.target.value));
  qs('#settingsQuietStart').addEventListener('change', (e) => savePreference('quiet_hours_start', e.target.value));
  qs('#settingsQuietEnd').addEventListener('change', (e) => savePreference('quiet_hours_end', e.target.value));
  qs('#settingsTheme').addEventListener('change', (e) => savePreference('theme', e.target.value));
  qs('#settingsAiModel').addEventListener('change', (e) => { localStorage.setItem('eduflow_assistant_model', e.target.value); savePreference('ai_model', e.target.value); });
  qs('#markAllNotificationsBtn').addEventListener('click', () => { notificationRecords().forEach((record) => notificationReadIds.add(record.id)); localStorage.setItem('eduflow_notification_read', JSON.stringify([...notificationReadIds])); renderFullNotifications(); renderMobileNotifications(); });
  qs('#accountEmailForm').addEventListener('submit', handleUpdateEmail);
  qs('#accountPasswordForm').addEventListener('submit', handleUpdatePassword);
  qs('#accountDeleteForm').addEventListener('submit', handleDeleteAccount);
  qs('#exportDataBtn').addEventListener('click', handleExportData);
  qs('#resendVerificationBtn').addEventListener('click', handleResendVerification);

  qs('#courseForm').addEventListener('submit', addCourse);
  qs('#courseSearch').addEventListener('input', (e) => { courseSearch = e.target.value.trim(); renderCourses(); });
  qsa('[data-course-filter]').forEach((tab) => tab.addEventListener('click', () => {
    courseFilter = tab.dataset.courseFilter;
    qsa('[data-course-filter]').forEach((item) => { const active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); });
    renderCourses();
  }));
  qsa('[data-announcement-filter]').forEach((tab) => tab.addEventListener('click', () => {
    announcementFilter = tab.dataset.announcementFilter;
    qsa('[data-announcement-filter]').forEach((item) => item.classList.toggle('active', item === tab));
    renderAnnouncements();
  }));
  qs('#timetableForm').addEventListener('submit', addClass);
  qs('#assignmentForm').addEventListener('submit', addAssignment);
  qs('#semesterForm').addEventListener('submit', addSemester);
  qs('#cgpaForm').addEventListener('submit', addCgpaEntry);
  qs('#calcTargetGpaBtn').addEventListener('click', calculateTargetGpa);
  qs('#exportCgpaPdfBtn').addEventListener('click', exportCgpaPdf);
  qs('#exportTimetablePdfBtn').addEventListener('click', exportTimetablePdf);
  qs('#exportTimetableIcsBtn').addEventListener('click', exportTimetableIcs);
  qs('#taskForm').addEventListener('submit', addTask);
  qs('#focusStartBtn').addEventListener('click', toggleFocusTimer);
  qs('#focusResetBtn').addEventListener('click', resetFocusTimer);
  renderFocusTimer();
  renderOfflineSyncStatus();
  window.addEventListener('online', flushPendingStudyActivity);

  qs('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = qs('#chatInput');
    sendChat(input.value);
    input.value = '';
  });
  qs('#assistantChatTab').addEventListener('click', () => setAssistantMode('chat'));
  qs('#assistantInsightsTab').addEventListener('click', () => setAssistantMode('insights'));
  setAssistantMode('chat');
  qsa('.chat-suggestion').forEach((btn) => {
    btn.addEventListener('click', () => sendChat(btn.textContent));
  });

  qs('#themeToggleBtn').addEventListener('click', toggleTheme);
  qs('#mobileMenuBtn').addEventListener('click', openSidebar);
  qs('#closeSidebarBtn').addEventListener('click', closeSidebar);
  qs('#sidebarOverlay').addEventListener('click', closeSidebar);

  tryResumeSession().then(() => {
    if (currentUser) {
      qs('#sidebarUserName').textContent = currentUser.name;
      qs('#sidebarUserEmail').textContent = currentUser.email;
    }
  });
}
document.addEventListener('DOMContentLoaded', init);
