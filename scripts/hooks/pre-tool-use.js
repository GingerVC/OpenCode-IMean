#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  appendHookLog,
  ensureRuntimeDirs,
  getLatestTask,
  getProjectRoot,
  isActiveState,
} = require('../lib/runtime');

const MAX_STDIN = 1024 * 1024;
let raw = '';

function parseInput() {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getToolName(input) {
  return String(
    input.tool_name ||
    input.toolName ||
    input.name ||
    input.tool ||
    input.matcher ||
    ''
  ).trim();
}

function getFilePath(input) {
  const candidate = input.tool_input?.file_path ||
    input.tool_input?.filePath ||
    input.input?.file_path ||
    input.input?.filePath ||
    input.file_path ||
    input.filePath ||
    '';

  return String(candidate || '').trim();
}

function isArtifactPath(projectRoot, filePath) {
  if (!filePath) return false;
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(projectRoot, filePath);
  const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
  return relativePath === '.oh-imean' || relativePath.startsWith('.oh-imean/');
}

function allow() {
  if (raw) process.stdout.write(raw);
  process.exit(0);
}

function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function main() {
  const projectRoot = getProjectRoot();
  ensureRuntimeDirs(projectRoot);

  const input = parseInput();
  const toolName = getToolName(input);
  const filePath = getFilePath(input);
  const task = getLatestTask(projectRoot);

  if (!task || !task.state) {
    return allow();
  }

  if (!isActiveState(task.state)) {
    return allow();
  }

  if (!['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
    return allow();
  }

  if (!filePath || isArtifactPath(projectRoot, filePath)) {
    return allow();
  }

  const phase = String(task.state.phase || '').trim();
  if (phase === 'tdd' || phase === 'implement') {
    return allow();
  }

  appendHookLog(
    projectRoot,
    `phase-gate blocked tool=${toolName} task=${task.taskSlug} phase=${phase || 'unknown'} file=${filePath}`
  );

  return block(
    `[oh-imean] Phase Gate Blocked: Cannot edit source file "${filePath}".\n\n` +
    `Reason: The current task "${task.taskSlug}" is actively in the "${phase || 'unknown'}" phase.\n` +
    `Action Required: You are NOT allowed to write or edit source code outside the "tdd" or "implement" phases.\n` +
    `Only ".oh-imean/" artifacts (like plan.md or review.md) can be modified right now.\n` +
    `Check ".oh-imean/specs/${task.taskSlug}/state.json" to understand your current role and phase.`
  );
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) {
    raw += chunk.slice(0, MAX_STDIN - raw.length);
  }
});
process.stdin.on('end', main);
