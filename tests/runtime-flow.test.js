'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  getLatestTask,
  getRecommendedNextCommand,
} = require('../scripts/lib/runtime');

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-runtime-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('runtime prefers active standardized task and recommends review command', () => {
  const projectRoot = createTempProject();
  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), {
    task_slug: 'demo-task',
    mode: 'standardized',
    phase: 'review',
    status: 'active',
  });
  const task = getLatestTask(projectRoot);
  assert.equal(task.taskSlug, 'demo-task');
  assert.equal(getRecommendedNextCommand(task), '/review demo-task');
});

test('runtime recommends plan for spec and tdd after planning', () => {
  const specTask = { taskSlug: 'demo-task', state: { mode: 'standardized', phase: 'spec' } };
  const planTask = { taskSlug: 'demo-task', state: { mode: 'standardized', phase: 'plan' } };
  const tddTask = { taskSlug: 'demo-task', state: { mode: 'standardized', phase: 'tdd' } };
  assert.equal(getRecommendedNextCommand(specTask), '/plan demo-task');
  assert.equal(getRecommendedNextCommand(planTask), '/tdd demo-task');
  assert.equal(getRecommendedNextCommand(tddTask), '/tdd demo-task');
});

test('runtime only recommends kickoff after implement phase', () => {
  const implementTask = { taskSlug: 'demo-task', state: { mode: 'standardized', phase: 'implement' } };
  assert.equal(getRecommendedNextCommand(implementTask), '/kickoff demo-task');
});
