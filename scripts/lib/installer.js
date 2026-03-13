'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_SCHEMA_URL = 'https://opencode.ai/config.json';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function pathExists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function readJson(filePath) {
  if (!pathExists(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function getOpenCodeConfigDir(options = {}) {
  const env = options.env || process.env;
  const homeDir = options.homeDir || os.homedir();
  const platform = options.platform || process.platform;
  const envConfigDir = env.OPENCODE_CONFIG_DIR && String(env.OPENCODE_CONFIG_DIR).trim();

  if (envConfigDir) {
    return path.resolve(envConfigDir);
  }

  if (platform === 'win32') {
    const crossPlatformDir = path.join(homeDir, '.config', 'opencode');
    const crossPlatformConfig = path.join(crossPlatformDir, 'opencode.json');
    if (pathExists(crossPlatformConfig)) {
      return crossPlatformDir;
    }

    const appData = env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    const appDataDir = path.join(appData, 'opencode');
    const appDataConfig = path.join(appDataDir, 'opencode.json');
    if (pathExists(appDataConfig)) {
      return appDataDir;
    }

    return crossPlatformDir;
  }

  const xdgConfigHome = env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
  return path.join(xdgConfigHome, 'opencode');
}

function getClaudeDir(options = {}) {
  const homeDir = options.homeDir || os.homedir();
  return path.join(homeDir, '.claude');
}

function getDefaultInstallDir(options = {}) {
  const env = options.env || process.env;
  const homeDir = options.homeDir || os.homedir();
  const platform = options.platform || process.platform;
  const override = env.OH_IMEAN_INSTALL_DIR && String(env.OH_IMEAN_INSTALL_DIR).trim();

  if (override) {
    return path.resolve(override);
  }

  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'OpenCode-IMean');
  }

  const dataHome = env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
  return path.join(dataHome, 'OpenCode-IMean');
}

function normalizePluginList(value) {
  if (Array.isArray(value)) {
    return value.slice();
  }

  if (typeof value === 'string' && value.trim()) {
    return [value];
  }

  return [];
}

function mergeOpenCodeConfig(config, pluginPath) {
  const base = config && typeof config === 'object' && !Array.isArray(config) ? { ...config } : {};
  const plugins = normalizePluginList(base.plugin);

  if (!plugins.includes(pluginPath)) {
    plugins.push(pluginPath);
  }

  return {
    ...base,
    $schema: base.$schema || DEFAULT_SCHEMA_URL,
    plugin: plugins,
  };
}

function removeOpenCodePlugin(config, pluginPath) {
  const base = config && typeof config === 'object' && !Array.isArray(config) ? { ...config } : {};
  const plugins = normalizePluginList(base.plugin).filter((entry) => entry !== pluginPath);

  if (!('plugin' in base) && plugins.length === 0) {
    return base;
  }

  return {
    ...base,
    $schema: base.$schema || DEFAULT_SCHEMA_URL,
    plugin: plugins,
  };
}

function resolvePluginId(pluginManifest) {
  const name = pluginManifest && typeof pluginManifest.name === 'string' && pluginManifest.name.trim()
    ? pluginManifest.name.trim()
    : 'oh-imean';
  const author = typeof pluginManifest?.author === 'string'
    ? pluginManifest.author.trim()
    : typeof pluginManifest?.author?.name === 'string'
      ? pluginManifest.author.name.trim()
      : '';

  if (author) {
    return name + '@' + author;
  }

  return name === 'oh-imean' ? 'oh-imean@vcbb' : name;
}

function mergeInstalledPluginsRegistry(registry, options) {
  const pluginId = options.pluginId;
  const installPath = options.installPath;
  const version = options.version || '0.0.0';
  const now = options.now || new Date().toISOString();
  const base = registry && typeof registry === 'object' && !Array.isArray(registry) ? registry : {};
  const plugins = base.plugins && typeof base.plugins === 'object' && !Array.isArray(base.plugins)
    ? { ...base.plugins }
    : {};
  const entries = Array.isArray(plugins[pluginId]) ? plugins[pluginId].map((entry) => ({ ...entry })) : [];
  const existingIndex = entries.findIndex((entry) => entry && entry.installPath === installPath);

  if (existingIndex >= 0) {
    const previous = entries[existingIndex];
    entries[existingIndex] = {
      ...previous,
      scope: previous.scope || 'user',
      installPath,
      version,
      installedAt: previous.installedAt || now,
      lastUpdated: now,
    };
  } else {
    entries.push({
      scope: 'user',
      installPath,
      version,
      installedAt: now,
      lastUpdated: now,
    });
  }

  plugins[pluginId] = entries;

  return {
    ...base,
    version: typeof base.version === 'number' ? base.version : 2,
    plugins,
  };
}

function removeInstalledPluginRegistration(registry, options) {
  const pluginId = options.pluginId;
  const installPath = options.installPath;
  const base = registry && typeof registry === 'object' && !Array.isArray(registry) ? registry : {};
  const plugins = base.plugins && typeof base.plugins === 'object' && !Array.isArray(base.plugins)
    ? { ...base.plugins }
    : {};
  const entries = Array.isArray(plugins[pluginId])
    ? plugins[pluginId].filter((entry) => entry && entry.installPath !== installPath)
    : [];

  if (entries.length > 0) {
    plugins[pluginId] = entries;
  } else {
    delete plugins[pluginId];
  }

  return {
    ...base,
    version: typeof base.version === 'number' ? base.version : 2,
    plugins,
  };
}

function mergeClaudeSettings(settings, pluginId) {
  const base = settings && typeof settings === 'object' && !Array.isArray(settings) ? { ...settings } : {};
  const enabledPlugins = base.enabledPlugins && typeof base.enabledPlugins === 'object' && !Array.isArray(base.enabledPlugins)
    ? { ...base.enabledPlugins }
    : {};
  enabledPlugins[pluginId] = true;
  return {
    ...base,
    enabledPlugins,
  };
}

function removeClaudePluginFromSettings(settings, pluginId) {
  const base = settings && typeof settings === 'object' && !Array.isArray(settings) ? { ...settings } : {};
  const enabledPlugins = base.enabledPlugins && typeof base.enabledPlugins === 'object' && !Array.isArray(base.enabledPlugins)
    ? { ...base.enabledPlugins }
    : {};
  delete enabledPlugins[pluginId];
  return {
    ...base,
    enabledPlugins,
  };
}

function installOpenCodeConfig(options) {
  const repoRoot = path.resolve(options.repoRoot);
  const configDir = getOpenCodeConfigDir(options);
  const configPath = path.join(configDir, 'opencode.json');
  const pluginPath = path.join(repoRoot, '.opencode', 'plugins');
  const nextConfig = mergeOpenCodeConfig(readJson(configPath), pluginPath);
  writeJson(configPath, nextConfig);
  return { configDir, configPath, pluginPath };
}

function uninstallOpenCodeConfig(options) {
  const repoRoot = path.resolve(options.repoRoot);
  const configDir = getOpenCodeConfigDir(options);
  const configPath = path.join(configDir, 'opencode.json');
  const pluginPath = path.join(repoRoot, '.opencode', 'plugins');
  const currentConfig = readJson(configPath);
  if (!currentConfig) {
    return { skipped: true, configDir, configPath, pluginPath };
  }
  const nextConfig = removeOpenCodePlugin(currentConfig, pluginPath);
  writeJson(configPath, nextConfig);
  return { configDir, configPath, pluginPath };
}

function shouldRegisterClaude(options = {}) {
  if (options.forceClaude) {
    return true;
  }

  if (options.skipClaude) {
    return false;
  }

  const claudeDir = getClaudeDir(options);
  return pathExists(claudeDir);
}

function installClaudeCompatConfig(options) {
  if (!shouldRegisterClaude(options)) {
    return { skipped: true };
  }

  const repoRoot = path.resolve(options.repoRoot);
  const manifestPath = path.join(repoRoot, '.claude-plugin', 'plugin.json');
  const manifest = readJson(manifestPath) || {};
  const pluginId = options.pluginId || resolvePluginId(manifest);
  const version = manifest.version || options.version || '0.0.0';
  const now = options.now || new Date().toISOString();
  const claudeDir = getClaudeDir(options);
  const pluginsDir = path.join(claudeDir, 'plugins');
  const installedPluginsPath = path.join(pluginsDir, 'installed_plugins.json');
  const settingsPath = path.join(claudeDir, 'settings.json');

  const nextRegistry = mergeInstalledPluginsRegistry(readJson(installedPluginsPath), {
    pluginId,
    installPath: repoRoot,
    version,
    now,
  });
  const nextSettings = mergeClaudeSettings(readJson(settingsPath), pluginId);

  writeJson(installedPluginsPath, nextRegistry);
  writeJson(settingsPath, nextSettings);

  return {
    skipped: false,
    claudeDir,
    installedPluginsPath,
    settingsPath,
    pluginId,
    version,
  };
}

function uninstallClaudeCompatConfig(options) {
  if (!shouldRegisterClaude(options)) {
    return { skipped: true };
  }

  const repoRoot = path.resolve(options.repoRoot);
  const manifestPath = path.join(repoRoot, '.claude-plugin', 'plugin.json');
  const manifest = readJson(manifestPath) || {};
  const pluginId = options.pluginId || resolvePluginId(manifest);
  const claudeDir = getClaudeDir(options);
  const pluginsDir = path.join(claudeDir, 'plugins');
  const installedPluginsPath = path.join(pluginsDir, 'installed_plugins.json');
  const settingsPath = path.join(claudeDir, 'settings.json');
  const currentRegistry = readJson(installedPluginsPath);
  const currentSettings = readJson(settingsPath);

  if (!currentRegistry && !currentSettings) {
    return {
      skipped: true,
      claudeDir,
      installedPluginsPath,
      settingsPath,
      pluginId,
    };
  }

  const nextRegistry = removeInstalledPluginRegistration(currentRegistry, {
    pluginId,
    installPath: repoRoot,
  });
  const nextSettings = removeClaudePluginFromSettings(currentSettings, pluginId);

  if (currentRegistry) {
    writeJson(installedPluginsPath, nextRegistry);
  }
  if (currentSettings) {
    writeJson(settingsPath, nextSettings);
  }

  return {
    skipped: false,
    claudeDir,
    installedPluginsPath,
    settingsPath,
    pluginId,
  };
}

function runInstaller(options) {
  const repoRoot = path.resolve(options.repoRoot);
  const openCode = options.skipOpenCode ? { skipped: true } : installOpenCodeConfig(options);
  const claude = installClaudeCompatConfig(options);
  return { repoRoot, openCode, claude };
}

function runUninstaller(options) {
  const repoRoot = path.resolve(options.repoRoot);
  const openCode = options.skipOpenCode ? { skipped: true } : uninstallOpenCodeConfig(options);
  const claude = uninstallClaudeCompatConfig(options);
  return { repoRoot, openCode, claude };
}

module.exports = {
  DEFAULT_SCHEMA_URL,
  ensureDir,
  getOpenCodeConfigDir,
  getClaudeDir,
  getDefaultInstallDir,
  mergeOpenCodeConfig,
  removeOpenCodePlugin,
  mergeInstalledPluginsRegistry,
  removeInstalledPluginRegistration,
  mergeClaudeSettings,
  removeClaudePluginFromSettings,
  resolvePluginId,
  installOpenCodeConfig,
  uninstallOpenCodeConfig,
  installClaudeCompatConfig,
  uninstallClaudeCompatConfig,
  runInstaller,
  runUninstaller,
};
