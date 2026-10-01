'use strict';

/* ================= ASSISTANT (client-side only, not persisted) ================= */
function pushChat(role, text) {
  state.chat.push({ role, text });
}
function renderChat() {
  const wrap = qs('#chatMessages');
  if (!state.chat.length) {
    pushChat('bot', `Hi ${getName() === 'there' ? '' : getName()}! I'm your study assistant. Ask me about your CGPA, deadlines, or today's classes.`);
  }
  wrap.innerHTML = state.chat.map((m) => `
    <div class="flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}">
      <div class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-teal dark:bg-teal-dark text-white rounded-br-sm' : 'bg-paper dark:bg-paper-dark rounded-bl-sm'} ${m.thinking ? 'animate-pulse' : ''}">
        ${escapeHtml(m.text)}
      </div>
    </div>
  `).join('');
  wrap.scrollTop = wrap.scrollHeight;
}
function botReply(rawInput) {
  const input = rawInput.toLowerCase();

  if (/\b(cgpa|gpa|grade point)\b/.test(input)) {
    if (!state.cumulative.units) return "You haven't logged any grades yet. Head to the CGPA calculator to add your courses and grades.";
    return `Your cumulative CGPA is ${state.cumulative.gpa.toFixed(2)} (${state.cumulative.classification}) across ${state.cumulative.units} units.`;
  }
  if (/\b(due|deadline|assignment|submit)\b/.test(input)) {
    const pending = [...state.assignments].filter((a) => !a.done).sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (!pending.length) return "Nothing pending right now — you're all caught up on assignments.";
    const next = pending[0];
    const due = dueLabel(next.due_date, next.done);
    return `You have ${pending.length} assignment${pending.length === 1 ? '' : 's'} pending. The nearest is "${next.title}" — ${due.text.toLowerCase()}.`;
  }
  if (/\b(class|timetable|schedule|lecture)\b/.test(input)) {
    const todayName = DAYS[new Date().getDay()];
    const todays = state.timetable.filter((t) => t.day === todayName).sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (!todays.length) return `No classes are scheduled for ${todayName} in your timetable.`;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const next = todays.find((t) => {
      const parts = t.start_time.split(':').map(Number);
      return parts[0] * 60 + parts[1] >= nowMinutes;
    });
    if (!next) return `You've got ${todays.length} class${todays.length === 1 ? '' : 'es'} today, and it looks like they're all done.`;
    return `Your next class today is ${next.course_name || 'a class'} at ${next.start_time}${next.location ? ' in ' + next.location : ''}.`;
  }
  if (/\b(progress|task|complet)\b/.test(input)) {
    if (!state.progress.totalItems) return "There's nothing tracked yet — add an assignment or a study task to see your progress.";
    return `You're at ${state.progress.percent}% completion across your assignments and study tasks.`;
  }
  if (/\b(hello|hi|hey|good morning|good afternoon|good evening)\b/.test(input)) {
    return `Hey ${getName() === 'there' ? '' : getName()}! What would you like to check — your CGPA, timetable, or assignments?`;
  }
  if (/\b(thank|thanks|thank you)\b/.test(input)) return 'Happy to help — good luck with your studies!';
  if (/\b(who are you|what are you)\b/.test(input)) {
    return "I'm KinvoHub's built-in study assistant — a lightweight helper running on simple logic, not a connected AI model. I answer using the data already on your dashboard.";
  }
  if (/\b(help|what can you do)\b/.test(input)) {
    return "I can tell you your CGPA, what's due soon, your next class, your study progress, or share a quick study tip. Just ask.";
  }
  return "Kinvo AI is not configured for general questions on this server yet. I can still answer questions about your CGPA, deadlines, timetable, and tracked progress.";
}
function sendChat(text) {
  const message = text.trim();
  if (!message) return;
  pushChat('user', message);
  renderChat();

  const thinkingMsg = { role: 'bot', text: '…', thinking: true };
  state.chat.push(thinkingMsg);
  renderChat();

  const historyForApi = state.chat
    .filter((m) => !m.thinking && m !== thinkingMsg)
    .slice(-10)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }));
  const selectedModel = state.preferences.ai_model || localStorage.getItem('eduflow_assistant_model') || '';

  apiFetch('/api/assistant/chat', { method: 'POST', body: JSON.stringify({ message, model: selectedModel, history: historyForApi }) })
    .then((data) => {
      state.chat = state.chat.filter((m) => m !== thinkingMsg);
      const reply = data.aiConfigured && data.reply ? data.reply : botReply(message);
      pushChat('bot', reply);
      renderChat();
    })
    .catch((err) => {
      state.chat = state.chat.filter((m) => m !== thinkingMsg);
      // A real response from the server (e.g. an hourly limit hit) carries
      // a specific message worth showing as-is. Only a genuine connection
      // failure falls back to the old built-in keyword replies.
      const isConnectionFailure = err.message.startsWith('Could not reach the server');
      pushChat('bot', isConnectionFailure ? botReply(message) : err.message);
      renderChat();
    });
}
let assistantMode = 'chat';
function renderAssistantInsights() {
  const pending = state.assignments.filter((item) => !item.done).sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
  const streak = Number((state.streak && state.streak.currentStreak) || 0);
  qs('#assistantInsightProgress').textContent = `${Number((state.progress && state.progress.percent) || 0)}%`;
  qs('#assistantInsightStreak').textContent = `${streak} day${streak === 1 ? '' : 's'}`;
  qs('#assistantInsightPending').textContent = pending.length;
  qs('#assistantInsightCourses').textContent = state.courses.length;
  const topics = [];
  if (pending.length) topics.push({ title: pending[0].title, meta: `Due ${pending[0].due_date || 'soon'} · highest priority`, pct: Math.min(92, 45 + pending.length * 8), color: '#315BEA' });
  if (state.courses.length) topics.push({ title: `Review ${state.courses[0].name}`, meta: `${state.courses[0].code || 'Active course'} · build a focused revision plan`, pct: 58, color: '#315BEA' });
  topics.push({ title: streak ? 'Keep your study streak going' : 'Start a focused study session', meta: 'KinvoHub recommendation · 25 minutes', pct: streak ? Math.min(95, 50 + streak * 5) : 25, color: '#159E93' });
  qs('#assistantSuggestedTopics').innerHTML = topics.map((topic) => `<button type="button" class="assistant-topic w-full text-left" data-topic="${escapeHtml(topic.title)}"><div class="flex items-center justify-between gap-3"><span class="min-w-0"><strong class="block text-sm truncate">${escapeHtml(topic.title)}</strong><small class="block mt-1 text-xs text-inksoft dark:text-inksoft-dark">${escapeHtml(topic.meta)}</small></span><b style="color:${topic.color}" class="text-xs">${topic.pct}%</b></div><span class="block h-1.5 mt-2 rounded-full bg-ink/10 dark:bg-ink-dark/10 overflow-hidden"><i class="block h-full rounded-full" style="width:${topic.pct}%;background:${topic.color}"></i></span></button>`).join('');
  qsa('.assistant-topic').forEach((button) => button.addEventListener('click', () => { setAssistantMode('chat'); sendChat(`Help me with ${button.dataset.topic}`); }));
}
function setAssistantMode(mode) {
  assistantMode = mode;
  const insights = mode === 'insights';
  qs('#assistantInsightsPanel').classList.toggle('hidden', !insights);
  qs('#assistantChatPanel').classList.toggle('hidden', insights);
  qs('#assistantSuggestions').classList.toggle('hidden', insights);
  qs('#assistantChatTab').classList.toggle('bg-surface', !insights);
  qs('#assistantChatTab').classList.toggle('dark:bg-surface-dark', !insights);
  qs('#assistantChatTab').classList.toggle('shadow-soft', !insights);
  qs('#assistantInsightsTab').classList.toggle('bg-surface', insights);
  qs('#assistantInsightsTab').classList.toggle('dark:bg-surface-dark', insights);
  qs('#assistantInsightsTab').classList.toggle('shadow-soft', insights);
  qs('#assistantChatTab').classList.toggle('text-inksoft', insights);
  qs('#assistantInsightsTab').classList.toggle('text-inksoft', !insights);
  if (insights) renderAssistantInsights();
}

function syncSettingsAiModelOptions(models, defaultModel) {
  const settingsSelect = qs('#settingsAiModel');
  if (!settingsSelect) return;
  settingsSelect.innerHTML = models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label)}</option>`).join('');
  const preferred = state.preferences.ai_model || localStorage.getItem('eduflow_assistant_model') || defaultModel;
  settingsSelect.value = models.some((model) => model.id === preferred) ? preferred : defaultModel;
}
async function initAssistantModels() {
  const select = qs('#assistantModelSelect');
  try {
    const data = await apiFetch('/api/assistant/models');
    qs('#assistantNotConfiguredNote').classList.toggle('hidden', data.aiConfigured);
    select.innerHTML = data.models.map((m) => `<option value="${m.id}">${escapeHtml(m.label)}</option>`).join('');
    const saved = state.preferences.ai_model || localStorage.getItem('eduflow_assistant_model');
    select.value = data.models.some((m) => m.id === saved) ? saved : data.default;
    localStorage.setItem('eduflow_assistant_model', select.value);
    syncSettingsAiModelOptions(data.models, data.default);
  } catch (e) {
    select.innerHTML = '<option value="">Default</option>';
    qs('#settingsAiModel').innerHTML = '<option value="">Default model</option>';
    qs('#assistantNotConfiguredNote').classList.remove('hidden');
  }
  select.addEventListener('change', () => {
    localStorage.setItem('eduflow_assistant_model', select.value);
    savePreference('ai_model', select.value);
  });
}

