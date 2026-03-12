'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'hooks', 'pre-tool-use.js');

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-gate-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runPreToolUse(projectRoot, payload) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: projectRoot,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: process.env,
  });
}

test('phase gate blocks source edits during spec', () => {
  const projectRoot = createTempProject();
  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), { task_slug: 'demo-task', mode: 'standardized', phase: 'spec', status: 'active' });
  const result = runPreToolUse(projectRoot, { tool_name: 'Edit', tool_input: { file_path: 'src/app.ts' } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Phase Gate Blocked/i);
});

test('phase gate blocks source edits during plan', () => {
  const projectRoot = createTempProject();
  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), { task_slug: 'demo-task', mode: 'standardized', phase: 'plan', status: 'active' });
  const result = runPreToolUse(projectRoot, { tool_name: 'Edit', tool_input: { file_path: 'src/app.ts' } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Phase Gate Blocked/i);
});

test('phase gate allows artifact edits outside implement', () => {
  const projectRoot = createTempProject();
  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), { task_slug: 'demo-task', mode: 'standardized', phase: 'plan', status: 'active' });
  const result = runPreToolUse(projectRoot, { tool_name: 'Edit', tool_input: { file_path: '.oh-imean/specs/demo-task/state.json' } });
  assert.equal(result.status, 0, result.stderr);
});

test('phase gate allows source edits for standardized task in tdd', () => {
  const projectRoot = createTempProject();
  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), { task_slug: 'demo-task', mode: 'standardized', phase: 'tdd', status: 'active' });
  const result = runPreToolUse(projectRoot, { tool_name: 'Edit', tool_input: { file_path: 'tests/login.test.ts' } });
  assert.equal(result.status, 0, result.stderr);
});

test('phase gate allows source edits for standardized task in implement', () => {
  const projectRoot = createTempProject();
  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), { task_slug: 'demo-task', mode: 'standardized', phase: 'implement', status: 'active' });
  const result = runPreToolUse(projectRoot, { tool_name: 'Edit', tool_input: { file_path: 'src/app.ts' } });
  assert.equal(result.status, 0, result.stderr);
});
