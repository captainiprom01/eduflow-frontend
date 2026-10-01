const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const storage = new Map([['eduflow_token', 'test-token']]);
let fetchCalls = 0;
const context = {
  console,
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  navigator: { onLine: false },
  fetch: async () => { fetchCalls += 1; return { ok: true, status: 200, json: async () => ({ ok: true }) }; },
  Date,
  Math,
  JSON,
  Promise,
  Error,
  setTimeout,
  clearTimeout,
};
vm.createContext(context);
for (const file of ['assets/js/api/client.js', 'assets/js/api/offline-queue.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

(async () => {
  const queued = await vm.runInContext("apiMutate('/api/tasks', { method: 'POST', body: JSON.stringify({ text: 'Read chapter 4' }) })", context);
  assert.strictEqual(queued.queued, true);
  assert.strictEqual(JSON.parse(storage.get('eduflow_pending_mutations')).length, 1);

  await vm.runInContext("apiMutate('/api/tasks', { method: 'POST', body: JSON.stringify({ text: 'Read chapter 4' }) })", context);
  assert.strictEqual(JSON.parse(storage.get('eduflow_pending_mutations')).length, 2, 'POST mutations remain individually replayable');

  await vm.runInContext("apiMutate('/api/tasks/7', { method: 'PATCH', body: JSON.stringify({ done: true }) })", context);
  await vm.runInContext("apiMutate('/api/tasks/7', { method: 'PATCH', body: JSON.stringify({ done: false }) })", context);
  const pendingBeforeFlush = JSON.parse(storage.get('eduflow_pending_mutations'));
  assert.strictEqual(pendingBeforeFlush.filter((item) => item.path === '/api/tasks/7').length, 1, 'latest PATCH replaces duplicate target mutation');

  context.navigator.onLine = true;
  await vm.runInContext('flushOfflineMutations()', context);
  assert.strictEqual(JSON.parse(storage.get('eduflow_pending_mutations')).length, 0);
  assert.strictEqual(fetchCalls, 3);

  context.fetch = async () => ({ ok: false, status: 422, json: async () => ({ error: 'Invalid task' }) });
  let validationError;
  try {
    await vm.runInContext("apiMutate('/api/tasks', { method: 'POST', body: JSON.stringify({ text: '' }) })", context);
  } catch (error) {
    validationError = error;
  }
  assert(validationError);
  assert.strictEqual(validationError.status, 422);
  assert.strictEqual(JSON.parse(storage.get('eduflow_pending_mutations')).length, 0, 'validation errors are not queued');

  console.log('KinvoHub offline mutation queue test: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
