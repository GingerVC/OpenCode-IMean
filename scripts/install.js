#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  runInstaller,
  runUninstaller,
  getDefaultInstallDir,
  getOpenCodeConfigDir,
  getClaudeDir,
} = require('./lib/installer');

function parseArgs(argv) {
  const args = {
    forceClaude: false,
    skipClaude: false,
    skipOpenCode: false,
    dryRun: false,
    uninstall: false,
    help: false,
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
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--uninstall') {
      args.uninstall = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/install.js [options]

Options:
  --repo-root <path>  Use a specific repository root
  --force-claude      Force Claude-compatible registration
  --skip-claude       Skip Claude-compatible registration
  --skip-opencode     Skip OpenCode registration
  --dry-run           Print planned actions without writing files
  --uninstall         Remove registered config instead of installing
  --help, -h          Show this help text`);
}

function getOpenCodeConfigPath(args) {
  return path.join(getOpenCodeConfigDir(args), 'opencode.json');
}

function getClaudePaths(args) {
  const claudeDir = getClaudeDir(args);
  return {
    claudeDir,
    installedPluginsPath: path.join(claudeDir, 'plugins', 'installed_plugins.json'),
    settingsPath: path.join(claudeDir, 'settings.json'),
  };
}

function hasCommand(command) {
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
  });
  return !result.error;
}

function printDryRun(args, repoRoot) {
  const openCodeConfigPath = getOpenCodeConfigPath(args);
  const claudePaths = getClaudePaths(args);
  const pluginPath = path.join(repoRoot, '.opencode', 'plugins');
  const mode = args.uninstall ? 'uninstall' : 'install';

  console.log(`OpenCode IMean installer dry run (${mode})`);
  console.log('- Repository root:', repoRoot);
  console.log('- Default install dir:', getDefaultInstallDir(args));
  console.log('- OpenCode config:', openCodeConfigPath);
  console.log('- OpenCode plugin path:', pluginPath);
  if (fs.existsSync(claudePaths.claudeDir) || args.forceClaude) {
    console.log('- Claude installed_plugins:', claudePaths.installedPluginsPath);
    console.log('- Claude settings:', claudePaths.settingsPath);
  } else {
    console.log('- Claude-compatible registration would be skipped (~/.claude not found)');
  }
  console.log('- git available:', hasCommand('git') ? 'yes' : 'no');
  console.log('- node version:', process.version);
  console.log('- opencode available:', hasCommand('opencode') ? 'yes' : 'no');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = args.repoRoot ? path.resolve(args.repoRoot) : path.resolve(__dirname, '..');

  if (args.help) {
    printHelp();
    return;
  }

  if (args.dryRun) {
    printDryRun(args, repoRoot);
    return;
  }

  if (!args.uninstall && !fs.existsSync(path.join(repoRoot, '.opencode', 'plugins'))) {
    throw new Error('Invalid repo root: .opencode/plugins not found');
  }

  const result = (args.uninstall ? runUninstaller : runInstaller)({
    ...args,
    repoRoot,
  });

  console.log(`OpenCode IMean ${args.uninstall ? 'uninstalled from' : 'installed from'}:`, result.repoRoot);
  if (result.openCode.skipped) {
    console.log(`- OpenCode ${args.uninstall ? 'removal' : 'registration'} skipped`);
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

  if (!args.uninstall) {
    console.log('- Suggested launch: opencode');
  }
  console.log('- Default install dir:', getDefaultInstallDir());
}

try {
  main();
} catch (error) {
  console.error('OpenCode IMean installer failed:', error && error.message ? error.message : String(error));
  process.exit(1);
}
