#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  appendHookLog,
  ensureRuntimeDirs,
  getCompactSnapshotPath,
  getLatestTask,
  getProjectRoot,
  getRecommendedNextCommand,
  getSessionId,
  writeJson,
} = require('../lib/runtime');
const { getHookProfile } = require('../lib/hook-flags');
const { buildCompactSnapshot } = require('../lib/templates');

const MAX_STDIN = 1024 * 1024;
let raw = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) {
    raw += chunk.slice(0, MAX_STDIN - raw.length);
  }
});
process.stdin.on('end', () => {
  main();
});

function main() {
  const projectRoot = getProjectRoot();
  ensureRuntimeDirs(projectRoot);

  const task = getLatestTask(projectRoot);
  const sessionId = getSessionId(raw || String(Date.now()));
  const snapshotPath = getCompactSnapshotPath(projectRoot, sessionId);

  writeJson(snapshotPath, buildCompactSnapshot({
    generated_at: new Date().toISOString(),
    hook_profile: getHookProfile(),
    mode: task ? task.state.mode || task.runtime?.mode || null : null,
    task_slug: task ? task.taskSlug : null,
    phase: task ? task.state.phase || null : null,
    verification_status: task ? task.state.verification_status || task.runtime?.verification_status || null : null,
    recommended_next_command: task ? (task.state.recommended_next_command || getRecommendedNextCommand(task)) : '/dispatch <需求>',
    selected_option: task ? task.state.selected_option || null : null,
    active_step: task ? task.state.active_step || null : null,
    last_blocking_reason: task ? task.state.last_blocking_reason || task.runtime?.last_blocking_reason || null : null,
  }));

  appendHookLog(
    projectRoot,
    `pre:compact snapshot=${path.relative(projectRoot, snapshotPath)} task=${task ? task.taskSlug : 'none'}`
  );
}
