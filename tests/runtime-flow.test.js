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

test('runtime prefers active quick-fix task and recommends review command', () => {
  const projectRoot = createTempProject();

  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'quick-task', 'state.json'), {
    task_slug: 'quick-task',
    mode: 'quick-fix',
    phase: 'review',
    status: 'active',
  });

  const task = getLatestTask(projectRoot);
  assert.equal(task.taskSlug, 'quick-task');
  assert.equal(getRecommendedNextCommand(task), '/review quick-task');
});

test('runtime recommends kickoff for quick-fix intake and verify for review completion chain', () => {
  const intakeTask = {
    taskSlug: 'quick-task',
    state: {
      mode: 'quick-fix',
      phase: 'intake',
    },
  };
  const reviewTask = {
    taskSlug: 'review-task',
    state: {
      mode: 'standardized',
      phase: 'review',
    },
  };
  const tddTask = {
    taskSlug: 'plan-task',
    state: {
      mode: 'standardized',
      phase: 'tdd',
    },
  };

  assert.equal(getRecommendedNextCommand(intakeTask), '/kickoff quick-task');
  assert.equal(getRecommendedNextCommand(tddTask), '/tdd plan-task');
  assert.equal(getRecommendedNextCommand(reviewTask), '/review review-task');
});

test('runtime can resume a lite direct plan without forcing another planning round', () => {
  const directPlanTask = {
    taskSlug: 'lite-task',
    state: {
      mode: 'standardized',
      phase: 'plan',
      selected_option: 'Direct lane',
      execution_lane: 'direct',
      planning_depth: 'lite',
    },
  };

  assert.equal(getRecommendedNextCommand(directPlanTask), '/kickoff lite-task Direct lane');
});
