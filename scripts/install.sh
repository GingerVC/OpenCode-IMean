#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${OH_IMEAN_REPO_URL:-https://github.com/GingerVC/OpenCode-IMean.git}"
REPO_REF="${OH_IMEAN_REPO_REF:-main}"
DRY_RUN=0
UNINSTALL=0

show_help() {
  cat <<'EOF'
OpenCode IMean installer

Usage:
  install.sh [--help] [--dry-run] [--uninstall]

Flags:
  --help       Show this help text
  --dry-run    Print the planned actions without changing files
  --uninstall  Remove OpenCode IMean config and delete the local install

Environment variables:
  OH_IMEAN_REPO_URL     Override the git repository URL
  OH_IMEAN_REPO_REF     Override the git branch or ref to install
  OH_IMEAN_INSTALL_DIR  Override the local installation directory
EOF
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

require_cmd() {
  if ! has_cmd "$1"; then
    echo "error: required command not found: $1" >&2
    exit 1
  fi
}

resolve_install_dir() {
  if [ -n "${OH_IMEAN_INSTALL_DIR:-}" ]; then
    printf '%s\n' "$OH_IMEAN_INSTALL_DIR"
    return
  fi

  case "$(uname -s)" in
    Darwin)
      printf '%s\n' "$HOME/Library/Application Support/OpenCode-IMean"
      ;;
    *)
      printf '%s\n' "${XDG_DATA_HOME:-$HOME/.local/share}/OpenCode-IMean"
      ;;
  esac
}

resolve_opencode_config_path() {
  if [ -n "${OPENCODE_CONFIG_DIR:-}" ]; then
    printf '%s\n' "$OPENCODE_CONFIG_DIR/opencode.json"
    return
  fi

  printf '%s\n' "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/opencode.json"
}

print_prerequisites() {
  local git_state node_state opencode_state
  if has_cmd git; then git_state="yes"; else git_state="no"; fi
  if has_cmd node; then node_state="yes"; else node_state="no"; fi
  if has_cmd opencode; then opencode_state="yes"; else opencode_state="no"; fi

  echo "Prerequisites:"
  echo "- git: $git_state"
  echo "- node: $node_state"
  echo "- opencode: $opencode_state"
}

print_dry_run() {
  local install_dir="$1"
  local opencode_config_path
  opencode_config_path="$(resolve_opencode_config_path)"

  echo "OpenCode IMean installer (dry run)"
  echo "- mode: $([ "$UNINSTALL" -eq 1 ] && printf 'uninstall' || printf 'install')"
  echo "- repository URL: $REPO_URL"
  echo "- repository ref: $REPO_REF"
  echo "- install dir: $install_dir"
  echo "- OpenCode config: $opencode_config_path"
  echo "- OpenCode plugin path: $install_dir/.opencode/plugins"
  if [ -d "$HOME/.claude" ]; then
    echo "- Claude-compatible registration: would update ~/.claude/plugins/installed_plugins.json and ~/.claude/settings.json"
  else
    echo "- Claude-compatible registration: skipped because ~/.claude was not found"
  fi
  print_prerequisites
  if ! has_cmd opencode; then
    echo "- note: opencode is not installed. The installer can still write config, but you must install OpenCode from https://opencode.ai/docs before launching the plugin."
  fi
  if [ "$UNINSTALL" -eq 1 ]; then
    echo "Actions:"
    echo "- remove OpenCode IMean registrations from OpenCode config"
    echo "- remove Claude-compatible plugin registration when present"
    echo "- delete the local install directory"
  else
    echo "Actions:"
    echo "- clone or update the local OpenCode IMean repository"
    echo "- merge the plugin path into OpenCode config"
    echo "- register the plugin for Claude-compatible loaders when available"
  fi
}

cleanup_uninstall() {
  local install_dir="$1"

  node - "$install_dir" <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const installDir = path.resolve(process.argv[2]);
const pluginPath = path.join(installDir, '.opencode', 'plugins');
const pluginId = 'oh-imean@vcbb';
const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const openCodeConfigPath = process.env.OPENCODE_CONFIG_DIR
  ? path.join(process.env.OPENCODE_CONFIG_DIR, 'opencode.json')
  : path.join(xdgConfigHome, 'opencode', 'opencode.json');
const claudeDir = path.join(os.homedir(), '.claude');
const installedPluginsPath = path.join(claudeDir, 'plugins', 'installed_plugins.json');
const settingsPath = path.join(claudeDir, 'settings.json');

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
};

const openCodeConfig = readJson(openCodeConfigPath);
if (openCodeConfig && typeof openCodeConfig === 'object' && !Array.isArray(openCodeConfig)) {
  const currentPlugins = Array.isArray(openCodeConfig.plugin)
    ? openCodeConfig.plugin
    : typeof openCodeConfig.plugin === 'string' && openCodeConfig.plugin
      ? [openCodeConfig.plugin]
      : [];
  openCodeConfig.plugin = currentPlugins.filter((entry) => entry !== pluginPath);
  writeJson(openCodeConfigPath, openCodeConfig);
}

const installedPlugins = readJson(installedPluginsPath);
if (installedPlugins && installedPlugins.plugins && typeof installedPlugins.plugins === 'object') {
  const entries = Array.isArray(installedPlugins.plugins[pluginId]) ? installedPlugins.plugins[pluginId] : [];
  const nextEntries = entries.filter((entry) => entry && entry.installPath !== installDir);
  if (nextEntries.length > 0) {
    installedPlugins.plugins[pluginId] = nextEntries;
  } else {
    delete installedPlugins.plugins[pluginId];
  }
  writeJson(installedPluginsPath, installedPlugins);
}

const settings = readJson(settingsPath);
if (settings && settings.enabledPlugins && typeof settings.enabledPlugins === 'object') {
  delete settings.enabledPlugins[pluginId];
  writeJson(settingsPath, settings);
}
NODE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)
      show_help
      exit 0
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --uninstall)
      UNINSTALL=1
      ;;
    *)
      echo "error: unknown flag: $1" >&2
      show_help >&2
      exit 1
      ;;
  esac
  shift
done

INSTALL_DIR="$(resolve_install_dir)"
PARENT_DIR="$(dirname "$INSTALL_DIR")"
TMP_DIR=""

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

if [ "$DRY_RUN" -eq 1 ]; then
  print_dry_run "$INSTALL_DIR"
  exit 0
fi

if [ "$UNINSTALL" -eq 1 ]; then
  require_cmd node
  cleanup_uninstall "$INSTALL_DIR"
  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "OpenCode IMean removed from $INSTALL_DIR"
  else
    echo "No existing OpenCode IMean install found at $INSTALL_DIR"
  fi
  exit 0
fi

require_cmd git
require_cmd node

mkdir -p "$PARENT_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing OpenCode IMean checkout in $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$REPO_REF"
  git -C "$INSTALL_DIR" reset --hard FETCH_HEAD
elif [ -e "$INSTALL_DIR" ]; then
  BACKUP_PATH="$INSTALL_DIR.backup.$(date +%Y%m%d%H%M%S)"
  echo "Existing non-git directory found at $INSTALL_DIR"
  echo "Backing it up to $BACKUP_PATH"
  mv "$INSTALL_DIR" "$BACKUP_PATH"
  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oh-imean.XXXXXX")"
  git clone --depth 1 --branch "$REPO_REF" "$REPO_URL" "$TMP_DIR"
  mv "$TMP_DIR" "$INSTALL_DIR"
  TMP_DIR=""
else
  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oh-imean.XXXXXX")"
  git clone --depth 1 --branch "$REPO_REF" "$REPO_URL" "$TMP_DIR"
  mv "$TMP_DIR" "$INSTALL_DIR"
  TMP_DIR=""
fi

if has_cmd opencode; then
  echo "Detected OpenCode: $(opencode --version 2>/dev/null || echo installed)"
else
  echo "warning: opencode command not found. Config will still be installed." >&2
  echo "warning: install OpenCode from https://opencode.ai/docs before launching OpenCode IMean." >&2
fi

NODE_ARGS=("$INSTALL_DIR/scripts/install.js" --repo-root "$INSTALL_DIR")
if [ -d "$HOME/.claude" ]; then
  NODE_ARGS+=(--force-claude)
fi

node "${NODE_ARGS[@]}"

echo "OpenCode IMean is ready."
if has_cmd opencode; then
  echo "Start with: opencode"
else
  echo "Install OpenCode first, then start with: opencode"
fi
