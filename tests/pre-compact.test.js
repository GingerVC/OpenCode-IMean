'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'hooks', 'pre-compact.js');

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-pre-compact-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('pre-compact snapshot keeps active step and blocker summary', () => {
  const projectRoot = createTempProject();
  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), {
    task_slug: 'demo-task',
    mode: 'standardized',
    phase: 'implement',
    status: 'active',
    active_step: '更新登录前置校验',
    last_blocking_reason: '等待 review 结论',
    recommended_next_command: '/kickoff demo-task',
  });
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: projectRoot,
    input: JSON.stringify({ session_id: 'compact-demo' }),
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  const logsDir = path.join(projectRoot, '.oh-imean', 'runtime', 'logs');
  const snapshotFile = fs.readdirSync(logsDir).find(name => name.startsWith('pre-compact-'));
  assert.ok(snapshotFile);
  const snapshot = JSON.parse(fs.readFileSync(path.join(logsDir, snapshotFile), 'utf8'));
  assert.equal(snapshot.mode, 'standardized');
  assert.equal(snapshot.active_step, '更新登录前置校验');
  assert.equal(snapshot.last_blocking_reason, '等待 review 结论');
});
