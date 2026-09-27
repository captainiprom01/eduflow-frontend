'use strict';

/* ---------- auth + API ---------- */
let authToken = localStorage.getItem('eduflow_token') || null;
let currentUser = (() => {
  try { return JSON.parse(localStorage.getItem('eduflow_user') || 'null'); } catch (e) { return null; }
})();
const DEFAULT_API_BASE = 'https://eduflow-s7wu.onrender.com';
let API_BASE = DEFAULT_API_BASE;

async function apiFetch(path, options) {
  options = options || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  let res;
  try {
    res = await fetch(API_BASE + path, Object.assign({}, options, { headers, credentials: 'include' }));
  } catch (e) {
    throw new Error('Could not reach the server. It may be waking up from sleep — wait 30 seconds and try again.');
  }
  if (res.status === 401) {
    const isAuthEndpoint = path === '/api/auth/login' || path === '/api/auth/signup';
    if (!isAuthEndpoint) {
      throw new Error('SESSION_EXPIRED');
    }
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* no JSON body, that's fine for 204s */ }
  if (!res.ok) throw new Error((data && data.error) || 'Something went wrong. If the server was asleep, try again in a moment.');
  return data;
}

