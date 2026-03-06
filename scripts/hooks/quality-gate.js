#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  appendHookLog,
  ensureRuntimeDirs,
  getProjectRoot,
} = require('../lib/runtime');

const MAX_STDIN = 1024 * 1024;
let raw = '';

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });
}

function getManualOptions(argv) {
  const options = {
    target: '.',
    fix: false,
    strict: false,
  };

  for (const value of argv) {
    if (value === '--fix') {
      options.fix = true;
    } else if (value === '--strict') {
      options.strict = true;
    } else if (!value.startsWith('--')) {
      options.target = value;
    }
  }

  return options;
}

function isIgnoredDir(dirName) {
  return [
    '.git',
    '.oh-imean',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.next',
  ].includes(dirName);
}

function collectFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];

  const files = [];
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      if (!isIgnoredDir(entry.name)) {
        files.push(...collectFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function splitByExtension(filePaths) {
  const groups = {
    frontend: [],
    python: [],
    go: [],
  };

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.js', '.jsx', '.ts', '.tsx', '.json', '.md'].includes(ext)) {
      groups.frontend.push(filePath);
    } else if (ext === '.py') {
      groups.python.push(filePath);
    } else if (ext === '.go') {
      groups.go.push(filePath);
    }
  }

  return groups;
}

function hasBiomeConfig(cwd) {
  return fs.existsSync(path.join(cwd, 'biome.json')) || fs.existsSync(path.join(cwd, 'biome.jsonc'));
}

function runChecks(groupedFiles, options, cwd) {
  const results = [];

  if (groupedFiles.frontend.length > 0) {
    if (hasBiomeConfig(cwd)) {
      const args = ['biome', 'check', ...groupedFiles.frontend];
      if (options.fix) args.push('--write');
      results.push({
        label: 'biome',
        result: run('npx', args, cwd),
      });
    } else {
      const args = ['prettier', options.fix ? '--write' : '--check', ...groupedFiles.frontend];
      results.push({
        label: 'prettier',
        result: run('npx', args, cwd),
      });
    }
  }

  if (groupedFiles.python.length > 0) {
    const args = ['format'];
    if (!options.fix) args.push('--check');
    args.push(...groupedFiles.python);
    results.push({
      label: 'ruff',
      result: run('ruff', args, cwd),
    });
  }

  if (groupedFiles.go.length > 0 && options.fix) {
    results.push({
      label: 'gofmt',
      result: run('gofmt', ['-w', ...groupedFiles.go], cwd),
    });
  }

  return results;
}

function printResults(results, strictMode) {
  let hasFailure = false;

  for (const item of results) {
    const failed = item.result.status !== 0;
    hasFailure = hasFailure || failed;
    const prefix = failed ? '[quality-gate] warning' : '[quality-gate] ok';
    process.stderr.write(`${prefix}: ${item.label}\n`);
    if (item.result.stdout) process.stderr.write(item.result.stdout);
    if (item.result.stderr) process.stderr.write(item.result.stderr);
  }

  return strictMode && hasFailure ? 1 : 0;
}

function runManual() {
  const projectRoot = getProjectRoot();
  ensureRuntimeDirs(projectRoot);

  const options = getManualOptions(process.argv.slice(2));
  const targetPath = path.resolve(projectRoot, options.target);
  const groupedFiles = splitByExtension(collectFiles(targetPath));
  const results = runChecks(groupedFiles, options, projectRoot);

  appendHookLog(
    projectRoot,
    `quality-gate manual target=${path.relative(projectRoot, targetPath) || '.'} fix=${options.fix} strict=${options.strict}`
  );

  process.exit(printResults(results, options.strict));
}

function runHook() {
  const projectRoot = getProjectRoot();
  ensureRuntimeDirs(projectRoot);

  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = {};
  }

  const filePath = input.tool_input?.file_path ? path.resolve(projectRoot, input.tool_input.file_path) : '';
  if (!filePath || !fs.existsSync(filePath)) {
    if (raw) process.stdout.write(raw);
    return;
  }

  const options = {
    fix: String(process.env.OH_IMEAN_QUALITY_GATE_FIX || '').toLowerCase() === 'true',
    strict: String(process.env.OH_IMEAN_QUALITY_GATE_STRICT || '').toLowerCase() === 'true',
  };

  const groupedFiles = splitByExtension([filePath]);
  const results = runChecks(groupedFiles, options, projectRoot);
  appendHookLog(
    projectRoot,
    `quality-gate hook file=${path.relative(projectRoot, filePath)} fix=${options.fix} strict=${options.strict}`
  );

  const exitCode = printResults(results, options.strict);
  process.stdout.write(raw);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

if (process.argv.length > 2) {
  runManual();
} else {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      raw += chunk.slice(0, MAX_STDIN - raw.length);
    }
  });
  process.stdin.on('end', () => {
    runHook();
  });
}
