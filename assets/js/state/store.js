'use strict';

/* ---------- state (client-side cache of what the server returns) ---------- */
const state = {
  courses: [],
  timetable: [],
  assignments: [],
  tasks: [],
  chat: [],
  cgpaEntries: [],
  semesters: [],
  cumulative: { gpa: 0, units: 0, classification: 'Add grades to calculate' },
  progress: { totalItems: 0, doneItems: 0, overdue: 0, percent: 0 },
  streak: null,
};
let activeSemesterId = null;
state.preferences = { assignment_notifications: true, announcement_notifications: true, grade_notifications: true, message_notifications: true, ai_suggestions: true, ai_reminders: true, ai_model: '', analytics_sharing: true, profile_visibility: true, theme: 'system', reminder_time: '18:00', quiet_hours_start: '22:00', quiet_hours_end: '07:00' };
