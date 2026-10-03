'use strict';

function showAuthScreen() {
  qs('#authScreen').classList.remove('hidden');
  qs('#appShell').classList.add('hidden');
}
function showApp() {
  qs('#authScreen').classList.add('hidden');
  qs('#appShell').classList.remove('hidden');
}
async function logout() {
  if (authToken) {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch (error) { /* local logout must still complete */ }
  }
  authToken = null;
  currentUser = null;
  localStorage.removeItem('eduflow_token');
  localStorage.removeItem('eduflow_user');
  showAuthScreen();
}
function getName() {
  return (currentUser && currentUser.name) || 'there';
}
/* ---------- account settings ---------- */
let profileEditing = false;
function renderProfile() {
  if (!currentUser) return;
  qs('#profileName').textContent = currentUser.name || 'Student';
  qs('#profileAcademicLine').textContent = [currentUser.department, currentUser.level].filter(Boolean).join(' · ') || 'Complete your academic details';
  qs('#profileEmail').textContent = currentUser.email || '';
  qs('#profileNameInput').value = currentUser.name || '';
  qs('#profileSchoolInput').value = currentUser.school || '';
  qs('#profileDepartmentInput').value = currentUser.department || '';
  qs('#profileProgrammeInput').value = currentUser.programme || '';
  qs('#profileLevelInput').value = currentUser.level || '';
  qs('#profileCourseCount').textContent = state.courses.length;
  qs('#profileCgpa').textContent = state.cumulative && state.cumulative.units ? state.cumulative.gpa.toFixed(2) : '—';
  qs('#profileAssignmentCount').textContent = state.assignments.filter((a) => !a.done).length;
  const cumulative = state.cumulative || { units: 0 };
  const completedCredits = Number(cumulative.units || 0);
  const totalCredits = state.courses.reduce((sum, course) => sum + Number(course.units || 0), 0);
  const creditProgress = totalCredits ? Math.min(100, Math.round((completedCredits / totalCredits) * 100)) : 0;
  qs('#profileCreditsCompleted').textContent = completedCredits;
  qs('#profileCreditsTotal').textContent = totalCredits;
  qs('#profileDegreeProgress').style.width = `${creditProgress}%`;
  qs('#profileDegreeProgressLabel').textContent = totalCredits ? `${creditProgress}% of registered course credits have grades` : 'Add courses and grades to track credit progress';
  qs('#profileActivityProgress').textContent = `${Number((state.progress && state.progress.percent) || 0)}% activity`;
  const courseProgress = state.courses.slice(0, 4).map((course) => {
    const activity = courseActivity(course.id);
    const done = activity.assignments.filter((assignment) => assignment.done).length;
    const percent = activity.assignments.length ? Math.round((done / activity.assignments.length) * 100) : 0;
    return `<div class="profile-course-progress-row"><div><span class="truncate">${escapeHtml(course.code || course.name)}</span><strong>${activity.assignments.length ? `${percent}%` : 'No tasks'}</strong></div><i><span style="width:${percent}%"></span></i></div>`;
  }).join('');
  qs('#profileCourseProgress').innerHTML = courseProgress || '<p class="text-xs text-inksoft dark:text-inksoft-dark">Your course activity will appear here after you add courses.</p>';
  const achievements = (state.streak && state.streak.achievements) || [];
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked).length;
  qs('#profileAchievementCount').textContent = `${unlockedAchievements}/${achievements.length}`;
  qs('#profileAchievements').innerHTML = achievements.length ? achievements.map((achievement) => `<div class="profile-achievement ${achievement.unlocked ? 'unlocked' : ''}"><i class="fa-solid ${escapeHtml(achievement.icon || 'fa-award')}"></i><strong>${escapeHtml(achievement.title)}</strong><small>${escapeHtml(achievement.unlocked ? achievement.description : `Locked · ${achievement.description}`)}</small></div>`).join('') : '<p class="text-xs text-inksoft dark:text-inksoft-dark">Achievements will appear as you build your academic activity.</p>';
  const hasSavedDetails = [currentUser.school, currentUser.department, currentUser.programme, currentUser.level].some((value) => String(value || '').trim());
  qs('#profileSchoolValue').textContent = currentUser.school || 'Not added yet';
  qs('#profileDepartmentValue').textContent = currentUser.department || 'Not added yet';
  qs('#profileProgrammeValue').textContent = currentUser.programme || 'Not added yet';
  qs('#profileLevelValue').textContent = currentUser.level || 'Not added yet';
  if (!profileEditing) {
    qs('#profileReadOnlyCard').classList.toggle('hidden', !hasSavedDetails);
    qs('#profileDetailsForm').classList.toggle('hidden', hasSavedDetails);
    qs('#profileCancelBtn').classList.add('hidden');
  }
}
function openProfileEditor() {
  profileEditing = true;
  qs('#profileReadOnlyCard').classList.add('hidden');
  qs('#profileDetailsForm').classList.remove('hidden');
  qs('#profileCancelBtn').classList.remove('hidden');
  qs('#profileNameInput').focus();
}
function cancelProfileEditor() {
  profileEditing = false;
  renderProfile();
}
async function handleProfileDetails(e) {
  e.preventDefault();
  const msg = qs('#profileDetailsMessage');
  try {
    const data = await apiFetch('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        name: qs('#profileNameInput').value.trim(),
        school: qs('#profileSchoolInput').value.trim(),
        department: qs('#profileDepartmentInput').value.trim(),
        programme: qs('#profileProgrammeInput').value.trim(),
        level: qs('#profileLevelInput').value.trim(),
      }),
    });
    currentUser = data.user;
    qs('#sidebarUserName').textContent = currentUser.name;
    profileEditing = false;
    localStorage.setItem('eduflow_user', JSON.stringify(currentUser));
    renderProfile();
    renderOverview();
    showFieldMessage(msg, 'Profile saved to your KinvoHub account.', false);
  } catch (err) {
    showFieldMessage(msg, err.message, true);
  }
}
function showFieldMessage(el, message, isError) {
  el.textContent = message;
  el.classList.remove('hidden', 'text-coral', 'text-teal');
  el.classList.add(isError ? 'text-coral' : 'text-teal');
}
function renderAccountSettings() {
  if (!currentUser) return;
  qs('#accountNameInput').value = currentUser.name;
  qs('#accountEmailInput').value = currentUser.email;
  const hasPassword = !!currentUser.has_password;
  qs('#accountEmailPasswordWrap').classList.toggle('hidden', !hasPassword);
  qs('#accountCurrentPasswordWrap').classList.toggle('hidden', !hasPassword);
  qs('#accountPasswordHint').classList.toggle('hidden', hasPassword);
  qs('#accountPasswordHeading').textContent = hasPassword ? 'Password' : 'Set a password';
  qs('#accountPasswordSubmitBtn').textContent = hasPassword ? 'Update password' : 'Set password';
  qs('#accountDeletePasswordWrap').classList.toggle('hidden', !hasPassword);
  qsa('.account-name-msg, .account-email-msg, .account-password-msg, .account-delete-msg').forEach((el) => el.classList.add('hidden'));
}
async function handleUpdateName(e) {
  e.preventDefault();
  const msg = qs('.account-name-msg');
  try {
    const data = await apiFetch('/api/account/profile', { method: 'PATCH', body: JSON.stringify({ name: qs('#accountNameInput').value.trim() }) });
    currentUser = data.user;
    qs('#sidebarUserName').textContent = currentUser.name;
    localStorage.setItem('eduflow_user', JSON.stringify(currentUser));
    renderProfile();
    showFieldMessage(msg, 'Name updated.', false);
  } catch (err) {
    showFieldMessage(msg, err.message, true);
  }
}
async function handleUpdateEmail(e) {
  e.preventDefault();
  const msg = qs('.account-email-msg');
  try {
    const data = await apiFetch('/api/account/email', {
      method: 'PATCH',
      body: JSON.stringify({ newEmail: qs('#accountEmailInput').value.trim(), currentPassword: qs('#accountEmailPassword').value }),
    });
    currentUser = data.user;
    qs('#sidebarUserEmail').textContent = currentUser.email;
    localStorage.setItem('eduflow_user', JSON.stringify(currentUser));
    qs('#accountEmailPassword').value = '';
    showFieldMessage(msg, 'Email updated.', false);
  } catch (err) {
    showFieldMessage(msg, err.message, true);
  }
}
async function handleUpdatePassword(e) {
  e.preventDefault();
  const msg = qs('.account-password-msg');
  try {
    const data = await apiFetch('/api/account/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: qs('#accountCurrentPassword').value, newPassword: qs('#accountNewPassword').value }),
    });
    currentUser.has_password = true;
    qs('#accountPasswordForm').reset();
    renderAccountSettings();
    showFieldMessage(qs('.account-password-msg'), data.message, false);
  } catch (err) {
    showFieldMessage(msg, err.message, true);
  }
}
async function handleExportData() {
  const btn = qs('#exportDataBtn');
  const msg = qs('.account-export-msg');
  btn.disabled = true;
  try {
    const data = await apiFetch('/api/account/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinvohub-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showFieldMessage(msg, err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function handleDeleteAccount(e) {
  e.preventDefault();
  const msg = qs('.account-delete-msg');
  const confirmed = window.confirm("This permanently deletes your account and everything in it. This can't be undone. Continue?");
  if (!confirmed) return;
  try {
    await apiFetch('/api/account', { method: 'DELETE', body: JSON.stringify({ currentPassword: qs('#accountDeletePassword').value }) });
    logout();
  } catch (err) {
    showFieldMessage(msg, err.message, true);
  }
}

function showAuthError(message) {
  qs('#authSuccess').classList.add('hidden');
  const el = qs('#authError');
  el.textContent = message;
  el.classList.remove('hidden');
}
function hideAuthError() {
  qs('#authError').classList.add('hidden');
}
function showAuthSuccess(message) {
  hideAuthError();
  const el = qs('#authSuccess');
  el.textContent = message;
  el.classList.remove('hidden');
}

function setAuthTab(tab) {
  const isLogin = tab === 'login';
  qs('#loginForm').classList.toggle('hidden', !isLogin);
  qs('#signupForm').classList.toggle('hidden', isLogin);
  qs('#forgotForm').classList.add('hidden');
  qs('#authTabLogin').classList.toggle('bg-teal', isLogin);
  qs('#authTabLogin').classList.toggle('text-white', isLogin);
  qs('#authTabSignup').classList.toggle('bg-teal', !isLogin);
  qs('#authTabSignup').classList.toggle('text-white', !isLogin);
  hideAuthError();
  qs('#authSuccess').classList.add('hidden');
}
function showForgotForm() {
  qs('#loginForm').classList.add('hidden');
  qs('#signupForm').classList.add('hidden');
  qs('#forgotForm').classList.remove('hidden');
  hideAuthError();
  qs('#authSuccess').classList.add('hidden');
}
function backToLogin() {
  qs('#forgotForm').classList.add('hidden');
  setAuthTab('login');
}

async function handleForgotPassword(e) {
  e.preventDefault();
  hideAuthError();
  const btn = qs('#forgotSubmitBtn');
  btn.disabled = true;
  try {
    const email = qs('#forgotEmail').value.trim();
    await apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    showAuthSuccess("If that email is registered, we've sent a reset link to it. Check your inbox.");
    qs('#forgotForm').reset();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const errorEl = qs('#resetPasswordError');
  const successEl = qs('#resetPasswordSuccess');
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');
  const btn = qs('#resetPasswordSubmitBtn');
  btn.disabled = true;
  try {
    const password = qs('#resetNewPassword').value;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    await apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
    successEl.textContent = 'Password updated. Redirecting you to log in…';
    successEl.classList.remove('hidden');
    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname;
    }, 1800);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

async function runEmailVerification(token) {
  const statusEl = qs('#verifyEmailStatus');
  const continueBtn = qs('#verifyEmailContinueBtn');
  try {
    const data = await apiFetch('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
    statusEl.textContent = data.message || 'Email verified. Thanks!';
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    continueBtn.classList.remove('hidden');
    continueBtn.addEventListener('click', () => {
      window.location.href = window.location.origin + window.location.pathname;
    });
  }
}

async function handleResendVerification() {
  const btn = qs('#resendVerificationBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  try {
    const data = await apiFetch('/api/auth/resend-verification', { method: 'POST' });
    btn.textContent = data.message;
    setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 4000);
  } catch (err) {
    btn.textContent = err.message;
    setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 4000);
  }
}

/* ---------- Google sign-in ----------
   GOOGLE_CLIENT_ID is a public identifier (not a secret) — safe to ship in
   frontend code. Leave it blank to hide the Google button entirely. */
const GOOGLE_CLIENT_ID = '505128710649-3s67r8pjadik3apc7f7j8ifk8jm78hgs.apps.googleusercontent.com';

async function handleGoogleCredentialResponse(response) {
  hideAuthError();
  try {
    const data = await apiFetch('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential }) });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('eduflow_token', authToken);
    localStorage.setItem('eduflow_user', JSON.stringify(currentUser));
    await bootApp();
  } catch (err) {
    showAuthError(err.message);
  }
}
function initGoogleSignIn() {
  if (!GOOGLE_CLIENT_ID || typeof google === 'undefined') return;
  qs('#googleSignInWrap').classList.remove('hidden');
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredentialResponse });
  google.accounts.id.renderButton(qs('#googleSignInBtn'), { theme: 'outline', size: 'large', width: 320 });
}

async function handleLogin(e) {
  e.preventDefault();
  hideAuthError();
  const btn = qs('#loginSubmitBtn');
  btn.disabled = true;
  try {
    const email = qs('#loginEmail').value.trim();
    const password = qs('#loginPassword').value;
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('eduflow_token', authToken);
    localStorage.setItem('eduflow_user', JSON.stringify(currentUser));
    await bootApp();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    btn.disabled = false;
  }
}
async function handleSignup(e) {
  e.preventDefault();
  hideAuthError();
  const btn = qs('#signupSubmitBtn');
  btn.disabled = true;
  try {
    const name = qs('#signupName').value.trim();
    const email = qs('#signupEmail').value.trim();
    const password = qs('#signupPassword').value;
    const data = await apiFetch('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('eduflow_token', authToken);
    localStorage.setItem('eduflow_user', JSON.stringify(currentUser));
    await bootApp();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    btn.disabled = false;
  }
}
