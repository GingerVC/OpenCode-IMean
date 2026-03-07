#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  appendHookLog,
  detectModeFromGoal,
  ensureRuntimeDirs,
  getLatestTask,
  getProjectRoot,
  getRecommendedNextCommand,
  getSessionFilePath,
  getSessionId,
  getTimestampString,
  readText,
  updateRuntimeTask,
  writeText,
} = require('../lib/runtime');
const { getHookProfile } = require('../lib/hook-flags');
const { buildSessionSummaryTemplate } = require('../lib/templates');

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

function parseInput() {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function collectTranscriptFacts(transcriptPath) {
  const content = readText(transcriptPath);
  if (!content) {
    return {
      userGoals: [],
      touchedFiles: [],
      failures: [],
      toolsUsed: [],
    };
  }

  const userGoals = [];
  const touchedFiles = new Set();
  const failures = new Set();
  const toolsUsed = new Set();

  for (const line of content.split('\n').filter(Boolean)) {
    try {
      const entry = JSON.parse(line);
      const rawContent = entry.message?.content ?? entry.content;
      const text = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map(item => item?.text || '').join(' ')
          : '';

      if ((entry.type === 'user' || entry.role === 'user' || entry.message?.role === 'user') && text.trim()) {
        userGoals.push(text.trim().slice(0, 200));
      }

      if (entry.type === 'tool_use' || entry.tool_name) {
        const toolName = entry.tool_name || entry.name || '';
        if (toolName) toolsUsed.add(toolName);
        const filePath = entry.tool_input?.file_path || entry.input?.file_path || '';
        if (filePath) touchedFiles.add(filePath);
      }

      if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_use') {
            if (block.name) toolsUsed.add(block.name);
            if (block.input?.file_path) touchedFiles.add(block.input.file_path);
          }
        }
      }

      const lowerText = text.toLowerCase();
      if (lowerText.includes('replan request') || lowerText.includes('blocked') || lowerText.includes('验证失败')) {
        failures.add(text.trim().slice(0, 200));
      }
    } catch {
      // Ignore invalid transcript lines.
    }
  }

  return {
    userGoals: userGoals.slice(-5),
    touchedFiles: Array.from(touchedFiles).slice(0, 20),
    failures: Array.from(failures).slice(0, 5),
    toolsUsed: Array.from(toolsUsed).slice(0, 20),
  };
}

function buildSessionSummary(task, facts, sessionId) {
  const state = task ? task.state : {};
  const goal = state.current_goal || facts.userGoals[facts.userGoals.length - 1] || '未检测到明确目标';
  const recommended = task ? (state.recommended_next_command || getRecommendedNextCommand(task)) : '/dispatch <需求>';
  const mode = task ? state.mode : detectModeFromGoal(goal);
  return buildSessionSummaryTemplate(sessionId, {
    generated_at: getTimestampString(),
    mode: mode || 'unknown',
    task_slug: task ? task.taskSlug : 'none',
    phase: state.phase || 'none',
    execution_lane: state.execution_lane || task?.runtime?.execution_lane || 'unknown',
    planning_depth: state.planning_depth || task?.runtime?.planning_depth || 'unknown',
    hook_profile: getHookProfile(),
    current_goal: goal,
    signals: facts.userGoals,
    failures: facts.failures,
    touched_files: facts.touchedFiles,
    tools_used: facts.toolsUsed,
    recommended_next_command: recommended,
    active_step: task && state.active_step ? state.active_step : '',
  });
}

function main() {
  const input = parseInput();
  const transcriptPath = input.transcript_path || process.env.CLAUDE_TRANSCRIPT_PATH || '';
  const transcriptSeed = transcriptPath || input.session_id || raw || String(Date.now());
  const sessionId = getSessionId(transcriptSeed);
  const projectRoot = getProjectRoot();

  ensureRuntimeDirs(projectRoot);

  const task = getLatestTask(projectRoot);
  if (task) {
    task.state.recommended_next_command = task.state.recommended_next_command || getRecommendedNextCommand(task);
  }

  const facts = collectTranscriptFacts(transcriptPath);
  const sessionSummary = buildSessionSummary(task, facts, sessionId);
  const sessionPath = getSessionFilePath(projectRoot, sessionId);

  writeText(sessionPath, sessionSummary);

  if (task) {
    updateRuntimeTask(projectRoot, task.taskSlug, {
      mode: task.state.mode || 'standardized',
      phase: task.state.phase || null,
      execution_lane: task.state.execution_lane || task.runtime?.execution_lane || null,
      planning_depth: task.state.planning_depth || task.runtime?.planning_depth || null,
      selected_option: task.state.selected_option || null,
      active_step: task.state.active_step || null,
      verification_status: task.state.verification_status || task.runtime?.verification_status || null,
      last_blocking_reason: task.state.last_blocking_reason || facts.failures[0] || null,
      last_session_id: sessionId,
      last_session_path: path.relative(projectRoot, sessionPath),
      last_session_summary: facts.userGoals[facts.userGoals.length - 1] || task.state.current_goal || null,
      last_session_at: new Date().toISOString(),
      last_verified_at: task.state.last_verified_at || task.runtime?.last_verified_at || null,
      hook_profile: getHookProfile(),
      recommended_next_command: task.state.recommended_next_command,
      touched_files: facts.touchedFiles,
      tools_used: facts.toolsUsed,
    });
  }

  appendHookLog(
    projectRoot,
    `stop:session-summary wrote ${path.relative(projectRoot, sessionPath)} task=${task ? task.taskSlug : 'none'}`
  );
}
