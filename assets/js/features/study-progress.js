'use strict';

/* ================= STUDY TASKS + PROGRESS ================= */
async function addTask(e) {
  e.preventDefault();
  const input = qs('#taskInput');
  const text = input.value.trim();
  if (!text) return;
  try {
    await apiMutate('/api/tasks', { method: 'POST', body: JSON.stringify({ text }) });
    input.value = '';
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
async function toggleTask(id, currentlyDone) {
  try {
    await apiMutate('/api/tasks/' + id, { method: 'PATCH', body: JSON.stringify({ done: !currentlyDone }) });
    if (!currentlyDone) { celebrate(); await recordStudyActivity('study_task_completed'); }
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
async function deleteTask(id) {
  try {
    await apiMutate('/api/tasks/' + id, { method: 'DELETE' });
    await reloadAll();
  } catch (err) { showToast(err.message); }
}
function renderTasks() {
  const wrap = qs('#taskList');
  if (!state.tasks.length) {
    wrap.innerHTML = emptyState('fa-pen', 'No study tasks yet', 'Add small study goals to track alongside your assignments.');
    return;
  }
  wrap.innerHTML = state.tasks.map((t) => `
    <div class="bg-paper dark:bg-paper-dark rounded-lg p-3 flex items-center gap-3 border border-ink/5 dark:border-ink-dark/5">
      <button aria-label="${t.done ? 'Mark as pending' : 'Mark as complete'}" onclick="toggleTask('${t.id}', ${t.done})" class="w-6 h-6 shrink-0 rounded-full border-2 ${t.done ? 'bg-teal border-teal' : 'border-ink/30 dark:border-ink-dark/30'} flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-teal">
        ${t.done ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : ''}
      </button>
      <p class="flex-1 text-sm ${t.done ? 'line-through text-inksoft dark:text-inksoft-dark' : ''}">${escapeHtml(t.text)}</p>
      <button aria-label="Delete task" onclick="deleteTask('${t.id}')" class="w-7 h-7 shrink-0 rounded-lg text-coral hover:bg-coral/10 focus:outline-none focus:ring-2 focus:ring-coral">
        <i class="fa-solid fa-trash text-xs"></i>
      </button>
    </div>
  `).join('');
}
let progressChartInstance = null;
function renderProgress() {
  const { percent, totalItems } = state.progress;
  qs('#progressPercentLabel').textContent = percent + '%';
  qs('#progressBarFill').style.width = percent + '%';
  let msg = 'Add assignments or study tasks to start tracking your progress.';
  if (totalItems) {
    if (percent === 100) msg = 'Everything is done. Great work — add new tasks to keep the momentum going.';
    else if (percent >= 70) msg = 'Almost there — a few tasks left to close out.';
    else if (percent >= 30) msg = "Steady progress. Keep chipping away at what's left.";
    else msg = 'Just getting started — small consistent steps add up.';
  }
  qs('#progressMessage').textContent = msg;
  renderTasks();
  renderProgressChart();
}
function renderProgressChart() {
  const canvas = qs('#progressChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const { totalItems, doneItems } = state.progress;
  const pending = totalItems - doneItems;
  const data = totalItems ? [doneItems, pending] : [0, 1];
  const isDark = document.documentElement.classList.contains('dark');
  if (progressChartInstance) {
    progressChartInstance.data.datasets[0].data = data;
    progressChartInstance.data.datasets[0].backgroundColor = ['#1F7A6C', totalItems ? '#DE9A2C' : (isDark ? '#243250' : '#E4E8F0')];
    progressChartInstance.options.plugins.legend.labels.color = isDark ? '#93A1C2' : '#54607F';
    progressChartInstance.update();
    return;
  }
  progressChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Pending'],
      datasets: [{ data, backgroundColor: ['#1F7A6C', totalItems ? '#DE9A2C' : (isDark ? '#243250' : '#E4E8F0')], borderWidth: 0 }],
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#93A1C2' : '#54607F', boxWidth: 10, padding: 12, font: { size: 11 } } } },
    },
  });
}

