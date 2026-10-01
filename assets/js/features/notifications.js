'use strict';

let notificationReadIds = new Set(JSON.parse(localStorage.getItem('eduflow_notification_read') || '[]'));
let courseFilter = 'all';
let courseSearch = '';
let activeCourseId = null;
const presenceUsers = new Set();
let campusAnnouncements = [];
let announcementFilter = 'All';
let announcementReadIds = new Set();
async function loadAnnouncements() {
  try {
    const data = await apiFetch('/api/announcements');
    campusAnnouncements = (data.announcements || []).map((announcement) => ({
      ...announcement,
      id: String(announcement.id),
      timestamp: announcement.published_at ? new Date(announcement.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
      unread: !announcement.read,
    }));
    announcementReadIds = new Set(campusAnnouncements.filter((item) => item.read).map((item) => item.id));
    renderAnnouncements();
    renderOverviewAnnouncements();
  } catch (error) {
    showDeterrentToast('Announcements could not be refreshed right now.');
  }
}
function announcementCategoryStyle(category) {
  const item = campusAnnouncements.find((announcement) => announcement.category === category);
  return item ? { color: item.color, bg: item.bg } : { color: '#315BEA', bg: '#EDF4FF' };
}
async function markAnnouncementRead(id) {
  announcementReadIds.add(String(id));
  const announcement = campusAnnouncements.find((item) => String(item.id) === String(id));
  if (announcement) announcement.read = true;
  try { await apiMutate(`/api/announcements/${encodeURIComponent(id)}/read`, { method: 'POST' }); } catch (error) { /* optimistic read state remains local until refresh */ }
}
function renderAnnouncements() {
  const wrap = qs('#announcementsList');
  if (!wrap) return;
  const records = announcementFilter === 'All' ? campusAnnouncements : campusAnnouncements.filter((announcement) => announcement.category === announcementFilter);
  const unread = records.filter((announcement) => !announcementReadIds.has(announcement.id) && announcement.unread).length;
  qs('#announcementsSummary').textContent = unread ? `${unread} unread announcement${unread === 1 ? '' : 's'}` : 'You’re up to date with campus news.';
  wrap.innerHTML = records.map((announcement) => {
    const style = announcementCategoryStyle(announcement.category);
    const isUnread = announcement.unread && !announcementReadIds.has(announcement.id);
    return `<button type="button" class="announcement-card" data-announcement-id="${announcement.id}"><span class="announcement-dot" style="background:${style.color}"></span><span class="announcement-card-main"><span class="announcement-meta"><span class="announcement-category" style="color:${style.color};background:${style.bg}">${announcement.category}</span>${isUnread ? '<span class="announcement-unread" aria-label="Unread"></span>' : ''}</span><h3>${escapeHtml(announcement.title)}</h3><p>${escapeHtml(announcement.body)}</p><time>${escapeHtml(announcement.author)} · ${escapeHtml(announcement.timestamp)}</time></span><i class="announcement-arrow fa-solid fa-chevron-right"></i></button>`;
  }).join('') || emptyState('fa-bullhorn', 'No announcements in this category', 'Try another filter to see more campus updates.');
  qsa('[data-announcement-id]').forEach((button) => button.addEventListener('click', () => {
    const announcement = campusAnnouncements.find((item) => item.id === button.dataset.announcementId);
    if (!announcement) return;
    markAnnouncementRead(announcement.id);
    showToast(`${announcement.title} marked as read.`);
    renderAnnouncements();
    renderOverviewAnnouncements();
  }));
}
function renderOverviewAnnouncements() {
  const wrap = qs('#overviewAnnouncements');
  if (!wrap) return;
  wrap.innerHTML = campusAnnouncements.slice(0, 3).map((announcement) => {
    const style = announcementCategoryStyle(announcement.category);
    return `<button type="button" class="overview-announcement" data-view="announcements"><span class="announcement-dot" style="background:${style.color}"></span><span class="overview-announcement-main"><strong>${escapeHtml(announcement.title)}</strong><small>${escapeHtml(announcement.author)} · ${escapeHtml(announcement.timestamp)}</small></span><i class="announcement-arrow fa-solid fa-chevron-right"></i></button>`;
  }).join('');
  wrap.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
}
function notificationRecords() {
  const records = [];
  if (state.preferences.assignment_notifications) {
    state.assignments.filter((assignment) => !assignment.done).forEach((assignment) => {
      const overdue = assignment.due_date && new Date(`${assignment.due_date}T23:59:59`) < new Date();
      records.push({ id: `assignment:${assignment.id}`, type: overdue ? 'Overdue assignment' : 'Assignment reminder', icon: overdue ? 'fa-clock' : 'fa-list-check', title: assignment.title, detail: overdue ? 'This assignment is overdue. Open Assignments to review it.' : `Due ${assignment.due_date || 'soon'}${assignment.course_name ? ` · ${assignment.course_name}` : ''}`, view: 'assignments', timestamp: assignment.due_date ? new Date(`${assignment.due_date}T12:00:00`) : new Date() });
    });
  }
  if (state.preferences.message_notifications && typeof messageState !== 'undefined') {
    messageState.conversations.filter((conversation) => Number(conversation.unread_count || 0) > 0).forEach((conversation) => records.push({ id: `message:${conversation.id}`, type: 'Unread message', icon: 'fa-message', title: conversationName(conversation), detail: `${conversation.unread_count} unread message${conversation.unread_count === 1 ? '' : 's'} waiting in this conversation.`, view: 'messages', timestamp: conversation.last_message_at ? new Date(conversation.last_message_at) : new Date() }));
  }
  if (currentUser && currentUser.email_verified === false) records.push({ id: 'verify-email', type: 'Account security', icon: 'fa-envelope-circle-check', title: 'Verify your email', detail: 'Verify your email to keep your EduFlow account secure.', view: 'account', timestamp: new Date() });
  const pendingTasks = state.tasks.filter((task) => !task.done).length;
  if (pendingTasks && state.preferences.assignment_notifications) records.push({ id: 'study-tasks:pending', type: 'Study tasks', icon: 'fa-pen', title: `${pendingTasks} study task${pendingTasks === 1 ? '' : 's'} still open`, detail: 'Keep your small study goals moving forward.', view: 'overview', timestamp: new Date() });
  return records.sort((a, b) => b.timestamp - a.timestamp);
}
function timeToMinutes(value) {
  const [hours, minutes] = String(value || '00:00').split(':').map(Number);
  return (hours * 60) + minutes;
}
function isQuietHours(date = new Date()) {
  const start = timeToMinutes(state.preferences.quiet_hours_start);
  const end = timeToMinutes(state.preferences.quiet_hours_end);
  const current = date.getHours() * 60 + date.getMinutes();
  return start === end ? false : start < end ? current >= start && current < end : current >= start || current < end;
}
function maybeShowSmartReminder() {
  if (!state.preferences.assignment_notifications || isQuietHours()) return;
  const reminder = timeToMinutes(state.preferences.reminder_time);
  const now = new Date();
  if ((now.getHours() * 60 + now.getMinutes()) < reminder) return;
  const pending = state.assignments.filter((item) => !item.done).length + state.tasks.filter((item) => !item.done).length;
  if (!pending) return;
  const key = `eduflow_smart_reminder_${localDateStr()}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, 'shown');
  showDeterrentToast(`You have ${pending} open study item${pending === 1 ? '' : 's'}. Start a focus session when you are ready.`);
}
function notificationGroupLabel(date) {
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
}
function markNotificationRead(id) {
  notificationReadIds.add(String(id));
  localStorage.setItem('eduflow_notification_read', JSON.stringify([...notificationReadIds]));
}
function renderFullNotifications() {
  const wrap = qs('#notificationsList');
  if (!wrap) return;
  const records = notificationRecords();
  const unread = records.filter((record) => !notificationReadIds.has(record.id)).length;
  qs('#notificationsSummary').textContent = unread ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'You’re all caught up.';
  if (!records.length) { wrap.innerHTML = '<div class="settings-card p-8 text-center"><i class="fa-regular fa-bell-slash text-3xl text-inksoft dark:text-inksoft-dark opacity-50"></i><p class="mt-3 font-semibold">No notifications yet</p><p class="mt-1 text-xs text-inksoft dark:text-inksoft-dark">New assignment, message, and account updates will appear here.</p></div>'; return; }
  const groups = ['Today', 'Yesterday', 'Earlier'].map((label) => ({ label, items: records.filter((record) => notificationGroupLabel(record.timestamp) === label) })).filter((group) => group.items.length);
  wrap.innerHTML = groups.map((group) => `<section class="notification-group"><h3>${group.label}</h3><div class="grid gap-2">${group.items.map((record) => { const unreadClass = notificationReadIds.has(record.id) ? '' : 'unread'; return `<button type="button" class="notification-item ${unreadClass}" onclick="markNotificationRead('${escapeHtml(record.id)}'); showView('${record.view}')"><span class="notification-icon"><i class="fa-solid ${record.icon}"></i></span><span class="flex-1 min-w-0"><strong>${escapeHtml(record.title)}</strong><p>${escapeHtml(record.detail)}</p><time>${escapeHtml(record.type)} · ${escapeHtml(record.timestamp.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</time></span>${unreadClass ? '<i class="notification-unread-dot"></i>' : ''}</button>`; }).join('')}</div></section>`).join('');
}
async function loadPreferences() {
  const themeVersion = themeInteractionVersion;
  try {
    const data = await apiFetch('/api/account/preferences');
    state.preferences = Object.assign(state.preferences, data.preferences || {});
    renderSettings();
    maybeShowSmartReminder();
    if (themeVersion === themeInteractionVersion) applyThemePreference(state.preferences.theme);
  } catch (err) { showToast(err.message); }
}
function renderSettings() {
  qsa('[data-preference]').forEach((input) => { input.checked = Boolean(state.preferences[input.dataset.preference]); });
  const theme = qs('#settingsTheme');
  if (theme) theme.value = state.preferences.theme || 'system';
  const reminderTime = qs('#settingsReminderTime');
  const quietStart = qs('#settingsQuietStart');
  const quietEnd = qs('#settingsQuietEnd');
  if (reminderTime) reminderTime.value = state.preferences.reminder_time || '18:00';
  if (quietStart) quietStart.value = state.preferences.quiet_hours_start || '22:00';
  if (quietEnd) quietEnd.value = state.preferences.quiet_hours_end || '07:00';
  const model = qs('#settingsAiModel');
  if (model && model.options.length) {
    const preferredModel = state.preferences.ai_model || localStorage.getItem('eduflow_assistant_model') || model.options[0].value;
    if ([...model.options].some((option) => option.value === preferredModel)) model.value = preferredModel;
  }
}
function applyThemePreference(theme) {
  if (theme === 'system') localStorage.removeItem('eduflow_theme');
  else localStorage.setItem('eduflow_theme', theme);
  const prefersDark = !!(systemThemeMedia && systemThemeMedia.matches);
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
  updateThemeToggleUI(isDark);
  if (progressChartInstance) renderProgressChart();
}
async function savePreference(field, value) {
  if (field === 'theme') themeInteractionVersion += 1;
  state.preferences[field] = value;
  if (field === 'theme') applyThemePreference(value);
  const status = qs('#preferencesSaveStatus');
  if (status) status.textContent = 'Saving…';
  try {
    const data = await apiMutate('/api/account/preferences', { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
    state.preferences = Object.assign(state.preferences, data.preferences || {});
    renderSettings();
    if (status) { status.textContent = 'Preferences saved to your account.'; setTimeout(() => { if (status) status.textContent = ''; }, 2200); }
  } catch (err) { if (status) status.textContent = err.message; }
}
