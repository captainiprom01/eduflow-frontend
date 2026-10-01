const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const shell = fs.readFileSync('assets/js/features/ui-shell.js', 'utf8');

const views = ['overview', 'courses', 'timetable', 'assignments', 'cgpa', 'progress', 'assistant', 'messages', 'notifications', 'announcements', 'profile', 'settings', 'account'];
for (const view of views) {
  assert(html.includes(`id="view-${view}"`), `missing view: ${view}`);
}
assert(shell.includes('const VIEWS ='));
assert(shell.includes('function showView(name)'));
assert(html.includes('data-mobile-nav'));
assert(html.includes('data-view="overview"'));
console.log('EduFlow navigation smoke test: PASS');
