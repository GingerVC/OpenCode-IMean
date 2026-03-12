'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  mergeOpenCodeConfig,
  mergeInstalledPluginsRegistry,
  mergeClaudeSettings,
  resolvePluginId,
  runInstaller,
} = require('../scripts/lib/installer');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-installer-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

test('mergeOpenCodeConfig appends plugin path without dropping existing keys', () => {
  const pluginPath = '/tmp/OpenCode-IMean/.opencode/plugins';
  const current = {
    $schema: 'https://opencode.ai/config.json',
    plugin: ['existing-plugin'],
    provider: {
      test: true,
    },
  };

  const next = mergeOpenCodeConfig(current, pluginPath);

  assert.deepEqual(next.plugin, ['existing-plugin', pluginPath]);
  assert.deepEqual(next.provider, current.provider);
});

test('mergeInstalledPluginsRegistry preserves existing plugins and adds current install', () => {
  const now = '2026-03-12T12:00:00.000Z';
  const current = {
    version: 2,
    plugins: {
      'other@example': [
        {
          scope: 'user',
          installPath: '/tmp/other',
          version: '1.0.0',
          installedAt: now,
          lastUpdated: now,
        },
      ],
    },
  };

  const next = mergeInstalledPluginsRegistry(current, {
    pluginId: 'oh-imean@vcbb',
    installPath: '/tmp/OpenCode-IMean',
    version: '0.1.0',
    now,
  });

  assert.equal(next.version, 2);
  assert.equal(next.plugins['other@example'][0].installPath, '/tmp/other');
  assert.equal(next.plugins['oh-imean@vcbb'][0].installPath, '/tmp/OpenCode-IMean');
  assert.equal(next.plugins['oh-imean@vcbb'][0].version, '0.1.0');
});

test('mergeClaudeSettings enables plugin without removing existing settings', () => {
  const current = {
    env: {
      FOO: 'bar',
    },
    enabledPlugins: {
      'other@example': true,
    },
  };

  const next = mergeClaudeSettings(current, 'oh-imean@vcbb');

  assert.deepEqual(next.env, current.env);
  assert.equal(next.enabledPlugins['other@example'], true);
  assert.equal(next.enabledPlugins['oh-imean@vcbb'], true);
});

test('resolvePluginId uses plugin manifest name and author', () => {
  assert.equal(resolvePluginId({ name: 'oh-imean', author: { name: 'vcbb' } }), 'oh-imean@vcbb');
});

test('runInstaller writes OpenCode and Claude-compatible config without overwriting existing entries', () => {
  const homeDir = createTempDir();
  const repoRoot = createTempDir();
  const now = '2026-03-12T12:00:00.000Z';
  const env = {
    XDG_CONFIG_HOME: path.join(homeDir, '.config'),
  };

  fs.mkdirSync(path.join(repoRoot, '.opencode', 'plugins'), { recursive: true });
  writeJson(path.join(repoRoot, '.claude-plugin', 'plugin.json'), {
    name: 'oh-imean',
    version: '0.1.0',
    author: { name: 'vcbb' },
  });

  writeJson(path.join(homeDir, '.config', 'opencode', 'opencode.json'), {
    plugin: ['existing-plugin'],
    provider: { keep: true },
  });
  writeJson(path.join(homeDir, '.claude', 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins: {
      'other@example': [
        {
          scope: 'user',
          installPath: '/tmp/other',
          version: '1.0.0',
          installedAt: now,
          lastUpdated: now,
        },
      ],
    },
  });
  writeJson(path.join(homeDir, '.claude', 'settings.json'), {
    env: { KEEP: '1' },
    enabledPlugins: { 'other@example': true },
  });

  const result = runInstaller({
    repoRoot,
    homeDir,
    env,
    now,
    forceClaude: true,
  });

  const opencodeConfig = JSON.parse(fs.readFileSync(result.openCode.configPath, 'utf8'));
  assert.deepEqual(opencodeConfig.plugin, ['existing-plugin', path.join(repoRoot, '.opencode', 'plugins')]);
  assert.deepEqual(opencodeConfig.provider, { keep: true });

  const installedPlugins = JSON.parse(fs.readFileSync(result.claude.installedPluginsPath, 'utf8'));
  assert.equal(installedPlugins.plugins['other@example'][0].installPath, '/tmp/other');
  assert.equal(installedPlugins.plugins['oh-imean@vcbb'][0].installPath, repoRoot);

  const settings = JSON.parse(fs.readFileSync(result.claude.settingsPath, 'utf8'));
  assert.equal(settings.env.KEEP, '1');
  assert.equal(settings.enabledPlugins['other@example'], true);
  assert.equal(settings.enabledPlugins['oh-imean@vcbb'], true);
});
