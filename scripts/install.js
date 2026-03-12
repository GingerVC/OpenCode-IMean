#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  runInstaller,
  getDefaultInstallDir,
} = require('./lib/installer');

function parseArgs(argv) {
  const args = {
    forceClaude: false,
    skipClaude: false,
    skipOpenCode: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo-root') {
      args.repoRoot = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--force-claude') {
      args.forceClaude = true;
      continue;
    }
    if (arg === '--skip-claude') {
      args.skipClaude = true;
      continue;
    }
    if (arg === '--skip-opencode') {
      args.skipOpenCode = true;
      continue;
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = args.repoRoot ? path.resolve(args.repoRoot) : path.resolve(__dirname, '..');

  if (!fs.existsSync(path.join(repoRoot, '.opencode', 'plugins'))) {
    throw new Error('Invalid repo root: .opencode/plugins not found');
  }

  const result = runInstaller({
    ...args,
    repoRoot,
  });

  console.log('OpenCode IMean installed from:', result.repoRoot);
  if (result.openCode.skipped) {
    console.log('- OpenCode registration skipped');
  } else {
    console.log('- OpenCode config:', result.openCode.configPath);
    console.log('- OpenCode plugin path:', result.openCode.pluginPath);
  }

  if (result.claude.skipped) {
    console.log('- Claude-compatible registration skipped (no ~/.claude detected)');
  } else {
    console.log('- Claude installed_plugins:', result.claude.installedPluginsPath);
    console.log('- Claude settings:', result.claude.settingsPath);
    console.log('- Claude plugin id:', result.claude.pluginId);
  }

  console.log('- Suggested launch: opencode');
  console.log('- Default install dir:', getDefaultInstallDir());
}

try {
  main();
} catch (error) {
  console.error('OpenCode IMean installer failed:', error && error.message ? error.message : String(error));
  process.exit(1);
}
