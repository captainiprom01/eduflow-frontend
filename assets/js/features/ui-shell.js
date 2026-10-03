'use strict';

/* ---------- theme ---------- */
let systemThemeMedia = null;
let themeInteractionVersion = 0;
function initTheme() {
  const saved = localStorage.getItem('eduflow_theme');
  systemThemeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const prefersDark = !!(systemThemeMedia && systemThemeMedia.matches);
  const isDark = saved === null ? prefersDark : saved === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  updateThemeToggleUI(isDark);
  if (systemThemeMedia) {
    const followSystemTheme = (event) => {
      if (localStorage.getItem('eduflow_theme') !== null) return;
      document.documentElement.classList.toggle('dark', event.matches);
      updateThemeToggleUI(event.matches);
      if (progressChartInstance) renderProgressChart();
    };
    if (systemThemeMedia.addEventListener) systemThemeMedia.addEventListener('change', followSystemTheme);
    else if (systemThemeMedia.addListener) systemThemeMedia.addListener(followSystemTheme);
  }
}
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  const theme = isDark ? 'dark' : 'light';
  localStorage.setItem('eduflow_theme', theme);
  state.preferences.theme = theme;
  if (authToken) savePreference('theme', theme);
  updateThemeToggleUI(isDark);
  if (progressChartInstance) renderProgressChart();
}
function updateThemeToggleUI(isDark) {
  qs('#themeIcon').className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  qs('#themeLabel').textContent = isDark ? 'Light mode' : 'Dark mode';
}

/* ---------- navigation ---------- */
const VIEWS = ['overview', 'courses', 'course-detail', 'timetable', 'assignments', 'cgpa', 'progress', 'assistant', 'messages', 'notifications', 'announcements', 'profile', 'settings', 'account'];
function hasPremiumAccess(feature) {
  return !!(currentUser && (currentUser.plan === 'premium' || (currentUser.access && currentUser.access.features && currentUser.access.features[feature] && currentUser.access.features[feature].available)));
}
function syncPremiumFeatureUI() {
  const locked = !hasPremiumAccess('assistant');
  const notice = qs('#assistantPremiumNotice');
  if (notice) notice.classList.toggle('hidden', !locked);
  ['#assistantTabs', '#assistantChatPanel', '#assistantSuggestions', '#assistantInsightsPanel'].forEach((selector) => {
    const element = qs(selector);
    if (element) element.classList.toggle('hidden', locked);
  });
}
function showView(name) {
  document.documentElement.dataset.eduflowNavState = name;
  const notificationPanel = qs('#mobileNotificationPanel');
  const notificationButton = qs('#mobileNotificationBtn');
  if (notificationPanel) notificationPanel.classList.add('hidden');
  if (notificationButton) notificationButton.setAttribute('aria-expanded', 'false');
  VIEWS.forEach((v) => {
    const el = qs('#view-' + v);
    if (el) el.classList.toggle('hidden', v !== name);
  });
  qsa('.nav-btn').forEach((btn) => {
    const active = btn.dataset.view === name;
    btn.classList.toggle('bg-teal', active);
    btn.classList.toggle('dark:bg-teal-dark', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('text-inksoft', !active);
    btn.classList.toggle('dark:text-inksoft-dark', !active);
  });
  qsa('[data-mobile-nav]').forEach((btn) => btn.classList.toggle('mobile-nav-active', btn.dataset.view === name));
  closeSidebar();
  if (name === 'progress') renderProgressChart();
  if (name === 'assistant') syncPremiumFeatureUI();
  if (name === 'course-detail') renderCourseDetail();
  if (name === 'profile') renderProfile();
  if (name === 'messages') { /* KinvoHub Messages is intentionally coming soon. */ }
  if (name === 'notifications') renderFullNotifications();
  if (name === 'announcements') { renderAnnouncements(); loadAnnouncements(); }
  if (name === 'settings') { renderSettings(); loadPreferences(); }
  if (name === 'account') renderAccountSettings();
  qs('#floatingAssistantBtn').classList.toggle('hidden', name === 'assistant');
  window.scrollTo(0, 0);
}
function initNav() {
  qsa('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
}
function openSidebar() {
  qs('#sidebar').classList.remove('-translate-x-full');
  qs('#sidebarOverlay').classList.remove('hidden');
}
function toggleSidebar() {
  if (qs('#sidebar').classList.contains('-translate-x-full')) openSidebar();
  else closeSidebar();
}
function closeSidebar() {
  if (window.innerWidth <= 1024 || window.matchMedia('(pointer: coarse) and (max-width: 1365px)').matches) {
    qs('#sidebar').classList.add('-translate-x-full');
    qs('#sidebarOverlay').classList.add('hidden');
  }
}

const GREETING_OPTIONS = {
  morning: ['Good morning', 'Morning, scholar', 'Rise and shine', 'Fresh day, fresh progress'],
  afternoon: ['Good afternoon', 'Welcome back', 'What\'s up', 'Hope your day is going well'],
  evening: ['Good evening', 'Welcome back this evening', 'Evening, scholar', 'Ready to wrap up strong'],
  night: ['Hello night owl', 'Late study session?', 'Good night, scholar', 'Burning the midnight oil?'],
};
let lastGreetingKey = '';
let lastGreetingText = '';
function greeting() {
  const now = new Date();
  const hour = now.getHours();
  const period = hour >= 5 && hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 22 ? 'evening' : 'night';
  const greetingKey = `${period}:${new Date().toDateString()}`;
  const options = GREETING_OPTIONS[period].filter((item) => item !== lastGreetingText || greetingKey !== lastGreetingKey);
  const selected = options[Math.floor(Math.random() * options.length)];
  lastGreetingKey = greetingKey;
  lastGreetingText = selected;
  return selected;
}
function renderGreeting() {
  const greetingText = greeting();
  const desktop = qs('#ovGreeting');
  const mobile = qs('#mobileGreeting');
  if (desktop) desktop.textContent = `${greetingText}, ${getName()}.`;
  if (mobile) mobile.textContent = `${greetingText},`;
}
function emptyState(icon, title, subtitle) {
  return `
    <div class="text-center py-6">
      <i class="fa-solid ${icon} text-2xl text-inksoft dark:text-inksoft-dark opacity-60"></i>
      <p class="text-sm font-semibold mt-2">${title}</p>
      <p class="text-xs text-inksoft dark:text-inksoft-dark mt-0.5">${subtitle}</p>
    </div>
  `;
}
