'use strict';

const OFFLINE_MUTATION_QUEUE_KEY = 'eduflow_pending_mutations';
const OFFLINE_MUTATION_QUEUE_LIMIT = 50;

function readOfflineMutations() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFLINE_MUTATION_QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeOfflineMutations(items) {
  try {
    localStorage.setItem(OFFLINE_MUTATION_QUEUE_KEY, JSON.stringify(items.slice(-OFFLINE_MUTATION_QUEUE_LIMIT)));
  } catch (error) {
    // Local storage is optional; the current action still receives its normal result.
  }
  if (typeof renderOfflineSyncStatus === 'function') renderOfflineSyncStatus();
}

function offlineMutationCount() {
  return readOfflineMutations().length;
}

function isRetryableMutationError(error) {
  return !error || !error.status || error.status >= 500 || error.message === 'SESSION_EXPIRED' || /^Could not reach/.test(error.message || '');
}

function mutationKey(path, options) {
  const method = options.method || 'POST';
  return `${method}:${path}`;
}

function queueOfflineMutation(path, options) {
  const method = options.method || 'POST';
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path,
    method,
    body: options.body || null,
    headers: options.headers || {},
    queuedAt: new Date().toISOString(),
  };
  const pending = readOfflineMutations();
  if (method === 'PATCH' || method === 'DELETE') {
    const key = mutationKey(path, options);
    const existing = pending.findIndex((entry) => mutationKey(entry.path, entry) === key);
    if (existing >= 0) pending.splice(existing, 1);
  }
  pending.push(item);
  writeOfflineMutations(pending);
  return { queued: true, offline: true, mutationId: item.id };
}

async function apiMutate(path, options) {
  options = Object.assign({}, options || {});
  if (navigator.onLine === false) return queueOfflineMutation(path, options);
  try {
    return await apiFetch(path, options);
  } catch (error) {
    if (!isRetryableMutationError(error)) throw error;
    return queueOfflineMutation(path, options);
  }
}

async function flushOfflineMutations() {
  if (!authToken || navigator.onLine === false) return;
  const pending = readOfflineMutations();
  if (!pending.length) return;
  const remaining = [];
  for (const item of pending) {
    try {
      await apiFetch(item.path, { method: item.method, body: item.body, headers: item.headers });
    } catch (error) {
      if (error && error.status >= 400 && error.status < 500 && error.status !== 401) continue;
      remaining.push(item);
      if (!isRetryableMutationError(error)) break;
    }
  }
  writeOfflineMutations(remaining);
}
