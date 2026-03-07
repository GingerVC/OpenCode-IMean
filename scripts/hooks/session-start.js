#!/usr/bin/env node
'use strict';

const {
  appendHookLog,
  ensureHandoffFile,
  ensureRuntimeDirs,
  getLatestTask,
  getProjectRoot,
  getRecommendedNextCommand,
  readText,
  updateRuntimeTask,
} = require('../lib/runtime');
const { getHookProfile } = require('../lib/hook-flags');
const { buildSessionStartTemplate } = require('../lib/templates');

function extractSessionPreview(filePath) {
  if (!filePath) return '';
  const content = readText(filePath).trim();
  if (!content) return '';

  return content
    .split('\n')
    .filter(Boolean)
    .slice(0, 8)
    .join('\n');
}

function buildOutput(task) {
  const { taskSlug, state, runtime, paths } = task;
  const recommended = state.recommended_next_command || getRecommendedNextCommand(task);
  const preview = extractSessionPreview(runtime && runtime.last_session_path);
  return buildSessionStartTemplate({
    mode: state.mode || runtime?.mode || 'unknown',
    task_slug: taskSlug,
    phase: state.phase || 'unknown',
    execution_lane: state.execution_lane || runtime?.execution_lane || 'unknown',
    planning_depth: state.planning_depth || runtime?.planning_depth || 'unknown',
    verification_status: state.verification_status || runtime?.verification_status || 'unknown',
    selected_option: state.selected_option || 'none',
    active_step: state.active_step || 'none',
    recommended_next_command: recommended,
    handoff: paths.handoff,
    latest_session_summary: preview,
    latest_review_summary: runtime?.last_review_summary || '',
    latest_verification_summary: runtime?.last_verification_summary || '',
  });
}

function main() {
  const projectRoot = getProjectRoot();
  ensureRuntimeDirs(projectRoot);

  const task = getLatestTask(projectRoot);
  if (!task) {
    appendHookLog(projectRoot, 'session:start no active standardized task');
    return;
  }

  ensureHandoffFile(projectRoot, task.taskSlug);

  const recommended = task.state.recommended_next_command || getRecommendedNextCommand(task);
  updateRuntimeTask(projectRoot, task.taskSlug, {
    last_session_started_at: new Date().toISOString(),
    mode: task.state.mode || task.runtime?.mode || null,
    execution_lane: task.state.execution_lane || task.runtime?.execution_lane || null,
    planning_depth: task.state.planning_depth || task.runtime?.planning_depth || null,
    hook_profile: getHookProfile(),
    recommended_next_command: recommended,
    phase: task.state.phase || null,
    verification_status: task.state.verification_status || task.runtime?.verification_status || null,
  });

  appendHookLog(
    projectRoot,
    `session:start restored task=${task.taskSlug} phase=${task.state.phase || 'unknown'}`
  );

  process.stdout.write(buildOutput(task));
}

try {
  main();
} catch (error) {
  process.stderr.write(`[oh-imean] session-start failed: ${error.message}\n`);
  process.exit(0);
}
