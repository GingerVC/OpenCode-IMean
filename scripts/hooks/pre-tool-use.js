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
  if (phase === 'implement') {
    return allow();
  }

  appendHookLog(
    projectRoot,
    `phase-gate blocked tool=${toolName} task=${task.taskSlug} phase=${phase || 'unknown'} file=${filePath}`
  );

  return block(
    `[oh-imean] phase gate blocked source edit for "${filePath}". Current standardized task "${task.taskSlug}" is in phase "${phase || 'unknown'}". Only ".oh-imean/" artifacts may be edited outside the implement phase.`
  );
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) {
    raw += chunk.slice(0, MAX_STDIN - raw.length);
  }
});
process.stdin.on('end', main);
