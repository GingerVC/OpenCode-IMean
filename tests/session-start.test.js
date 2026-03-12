'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'hooks', 'session-start.js');

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-session-start-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('session start renders structured resume output', () => {
  const projectRoot = createTempProject();
  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), {
    task_slug: 'demo-task',
    mode: 'standardized',
    phase: 'verify',
    status: 'active',
    active_step: '执行最终验证',
    recommended_next_command: '/verify demo-task',
  });
  const sessionPath = path.join(projectRoot, '.oh-imean', 'runtime', 'sessions', '2026-03-06-demo.md');
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, '# Session Summary\n\n## Current Goal\n修复登录限流\n', 'utf8');
  writeJson(path.join(projectRoot, '.oh-imean', 'runtime', 'tasks', 'demo-task.json'), {
    task_slug: 'demo-task',
    last_session_path: '.oh-imean/runtime/sessions/2026-03-06-demo.md',
    verification_status: 'pending',
  });
  const result = spawnSync(process.execPath, [SCRIPT_PATH], { cwd: projectRoot, encoding: 'utf8', env: process.env });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## Context/);
  assert.match(result.stdout, /## Latest Session Summary/);
  assert.match(result.stdout, /- mode: standardized/);
  assert.match(result.stdout, /- phase: verify/);
  assert.match(result.stdout, /\/verify demo-task/);
});

test('session start restores standardized review task and shows recent review summary', () => {
  const projectRoot = createTempProject();
  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), {
    task_slug: 'demo-task',
    mode: 'standardized',
    phase: 'review',
    status: 'active',
    active_step: '独立审查实现结果',
    recommended_next_command: '/review demo-task',
  });
  const reviewPath = path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'review.md');
  fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
  fs.writeFileSync(reviewPath, '# Review Report\n\n## Findings\n- 无发现\n', 'utf8');
  writeJson(path.join(projectRoot, '.oh-imean', 'runtime', 'tasks', 'demo-task.json'), {
    task_slug: 'demo-task',
    review_status: 'pass',
    verification_status: 'pending',
    last_review_summary: '无发现',
  });
  const result = spawnSync(process.execPath, [SCRIPT_PATH], { cwd: projectRoot, encoding: 'utf8', env: process.env });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /- mode: standardized/);
  assert.match(result.stdout, /- phase: review/);
  assert.match(result.stdout, /- recommended_next_command: \/review demo-task/);
  assert.match(result.stdout, /无发现/);
});
