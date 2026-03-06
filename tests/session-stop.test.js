'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'hooks', 'session-stop.js');

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-session-stop-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runSessionStop(projectRoot, payload) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: projectRoot,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: process.env,
  });
}

test('session stop writes structured session summary with tools used', () => {
  const projectRoot = createTempProject();

  writeJson(path.join(projectRoot, '.oh-imean', 'specs', 'demo-task', 'state.json'), {
    task_slug: 'demo-task',
    mode: 'standardized',
    phase: 'implement',
    status: 'active',
    current_goal: '修复登录限流逻辑',
    active_step: '补充登录失败计数',
    recommended_next_command: '/verify demo-task',
  });

  const transcriptPath = path.join(projectRoot, 'transcript.jsonl');
  fs.writeFileSync(
    transcriptPath,
    [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: '请修复登录限流 bug' },
      }),
      JSON.stringify({
        type: 'tool_use',
        tool_name: 'Edit',
        tool_input: { file_path: 'src/login.ts' },
      }),
    ].join('\n') + '\n',
    'utf8',
  );

  const result = runSessionStop(projectRoot, {
    transcript_path: transcriptPath,
    session_id: 'demo-session',
  });

  assert.equal(result.status, 0, result.stderr);

  const sessionsDir = path.join(projectRoot, '.oh-imean', 'runtime', 'sessions');
  const sessionFiles = fs.readdirSync(sessionsDir);
  assert.equal(sessionFiles.length, 1);

  const content = fs.readFileSync(path.join(sessionsDir, sessionFiles[0]), 'utf8');
  assert.match(content, /## Context/);
  assert.match(content, /## Tools Used/);
  assert.match(content, /- Edit/);
  assert.match(content, /## Next Step/);
});
