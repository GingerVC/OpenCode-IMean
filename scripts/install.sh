#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${OH_IMEAN_REPO_URL:-https://github.com/vc999999999/OpenCode-IMean.git}"
REPO_REF="${OH_IMEAN_REPO_REF:-main}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command not found: $1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd node

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

INSTALL_DIR="$(resolve_install_dir)"
PARENT_DIR="$(dirname "$INSTALL_DIR")"
TMP_DIR=""

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

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

if command -v opencode >/dev/null 2>&1; then
  echo "Detected OpenCode: $(opencode --version 2>/dev/null || echo installed)"
else
  echo "warning: opencode command not found. Config will still be installed." >&2
fi

NODE_ARGS=("$INSTALL_DIR/scripts/install.js" --repo-root "$INSTALL_DIR")
if [ -d "$HOME/.claude" ]; then
  NODE_ARGS+=(--force-claude)
fi

node "${NODE_ARGS[@]}"

echo "OpenCode IMean is ready. Start with: opencode"
