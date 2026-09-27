'use strict';

/* ================= OVERVIEW ================= */
/* ---------- celebration ---------- */
function celebrate() {
  if (typeof confetti !== 'function') return;
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ['#1F7A6C', '#DE9A2C', '#12213F'] });
}


/* ---------- daily focus insight ---------- */
const DAILY_QUOTES_FALLBACK = [
  'Small steps every day beat big pushes once in a while.',
  'Progress, not perfection. Focus on the next useful step.',
  'Consistency beats intensity. Give yourself a focused session today.',
  'Every assignment you finish is one less thing carrying weight in your head.',
  'Study smart, not just hard. Protect your focus and your rest.',
  'A focused twenty minutes can change the direction of your whole day.',
  'You do not need to finish everything today; start with the next useful thing.',
  'Your future self benefits from the effort you make in this moment.',
  'Learning compounds quietly. Keep adding one clear step at a time.',
  'Make progress visible: choose one task, begin it, and stay with it.',
];
function renderQuoteOfTheDay(dateKey = localDateStr()) {
  // Use a UTC date key rather than milliseconds since local New Year's Eve.
  // Millisecond-based day-of-year calculations can repeat or skip a quote
  // around daylight-saving transitions in the user's local timezone.
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const quoteEl = qs('#dailyQuote');
  if (quoteEl) quoteEl.textContent = DAILY_QUOTES_FALLBACK[dayNumber % DAILY_QUOTES_FALLBACK.length];
}
async function loadDailyQuote() {
  const date = localDateStr();
  try {
    const data = await apiFetch('/api/quotes/daily?date=' + encodeURIComponent(date));
    const quoteEl = qs('#dailyQuote');
    if (quoteEl && data && data.quote) quoteEl.textContent = data.quote;
  } catch (error) {
    // Keep the card useful if the API is waking up or temporarily unavailable.
    renderQuoteOfTheDay(date);
  }
}
/* ---------- XP / level ---------- */
function computeXp() {
  const completedAssignments = state.assignments.filter((a) => a.done).length;
  const completedTasks = state.tasks.filter((t) => t.done).length;
  const unlockedAchievements = state.streak ? state.streak.unlockedCount : 0;
  const longestStreak = state.streak ? state.streak.longestStreak : 0;
  const semesterCount = state.semesters.length;
  return completedAssignments * 10 + completedTasks * 10 + unlockedAchievements * 50 + longestStreak * 5 + semesterCount * 20;
}
function levelForXp(xp) {
  let level = 1;
  let threshold = 100;
  let remaining = xp;
  while (remaining >= threshold) {
    remaining -= threshold;
    level++;
    threshold = Math.round(threshold * 1.25);
  }
  return { level, xpIntoLevel: remaining, xpForNextLevel: threshold };
}
function renderLevel() {
  const xp = computeXp();
  const { level, xpIntoLevel, xpForNextLevel } = levelForXp(xp);
  qs('#levelLabel').textContent = `Level ${level}`;
  qs('#xpLabel').textContent = `${xpIntoLevel} / ${xpForNextLevel} XP`;
  qs('#xpBarFill').style.width = `${Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))}%`;
}

function renderStreak() {
  const s = state.streak;
  if (!s) return;

  // Celebrate any achievement that's unlocked now but wasn't the last time
  // we checked — tracked on this device only, purely for the confetti
  // moment, not a source of truth (the server always recomputes fresh).
  const seenKey = 'eduflow_seen_achievements';
  const previouslySeen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]'));
  const nowUnlocked = s.achievements.filter((a) => a.unlocked).map((a) => a.title);
  const newlyUnlocked = nowUnlocked.filter((title) => !previouslySeen.has(title));
  if (newlyUnlocked.length && previouslySeen.size > 0) {
    celebrate();
    showToast(`🎉 Achievement unlocked: ${newlyUnlocked[0]}${newlyUnlocked.length > 1 ? ` (+${newlyUnlocked.length - 1} more)` : ''}`);
  }
  localStorage.setItem(seenKey, JSON.stringify(nowUnlocked));

  const countEl = qs('#streakCount');
  const msgEl = qs('#streakMessage');
  const longestEl = qs('#streakLongest');

  countEl.textContent = `${s.currentStreak} day${s.currentStreak === 1 ? '' : 's'} streak`;
  longestEl.textContent = `Best: ${s.longestStreak} day${s.longestStreak === 1 ? '' : 's'}`;

  if (s.currentStreak === 0) {
    msgEl.textContent = 'Complete something today to start a new streak.';
  } else if (s.currentStreak >= 7) {
    msgEl.textContent = "You're on fire — keep showing up.";
  } else {
    msgEl.textContent = "You're checked in for today. Come back tomorrow to keep it going.";
  }

  qs('#achievementsCount').textContent = `${s.unlockedCount} of ${s.totalCount} unlocked`;
  qs('#achievementsGrid').innerHTML = s.achievements.map((a) => `
    <div class="flex flex-col items-center text-center gap-1.5 p-2 rounded-xl ${a.unlocked ? '' : 'opacity-40'}" title="${escapeHtml(a.description)}">
      <div class="w-12 h-12 rounded-full flex items-center justify-center ${a.unlocked ? 'bg-gradient-to-br from-teal to-amber text-white' : 'bg-ink/10 dark:bg-ink-dark/10 text-inksoft dark:text-inksoft-dark'}">
        <i class="fa-solid ${a.icon} text-lg"></i>
      </div>
      <p class="text-[11px] font-semibold leading-tight">${escapeHtml(a.title)}</p>
    </div>
  `).join('');

  renderLevel();
}
