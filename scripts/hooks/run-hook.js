#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isHookEnabled } = require('../lib/hook-flags');

const MAX_STDIN = 1024 * 1024;

function getPluginRoot() {
  if (process.env.CLAUDE_PLUGIN_ROOT && process.env.CLAUDE_PLUGIN_ROOT.trim()) {
    return process.env.CLAUDE_PLUGIN_ROOT;
  }

  return path.resolve(__dirname, '..', '..');
}

function readStdin() {
  return new Promise(resolve => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      if (raw.length < MAX_STDIN) {
        raw += chunk.slice(0, MAX_STDIN - raw.length);
      }
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', () => resolve(raw));
  });
}

async function main() {
  const [, , hookId, relativeScriptPath, profilesCsv] = process.argv;
  const raw = await readStdin();

  if (!hookId || !relativeScriptPath) {
    if (raw) process.stdout.write(raw);
    return;
  }

  if (!isHookEnabled(hookId, { profiles: profilesCsv })) {
    if (raw) process.stdout.write(raw);
    return;
  }

  const scriptPath = path.join(getPluginRoot(), relativeScriptPath);
  if (!fs.existsSync(scriptPath)) {
    process.stderr.write(`[oh-imean] hook script not found: ${scriptPath}\n`);
    if (raw) process.stdout.write(raw);
    return;
  }

  const result = spawnSync(process.execPath, [scriptPath], {
    input: raw,
    encoding: 'utf8',
    cwd: process.cwd(),
    env: process.env,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(Number.isInteger(result.status) ? result.status : 0);
}

main().catch(error => {
  process.stderr.write(`[oh-imean] hook runner error: ${error.message}\n`);
  process.exit(0);
});
