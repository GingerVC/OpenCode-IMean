# Installation

## Prerequisites

- `git` is required by the installer to clone or update the repository
- `node` is required by the installer to merge config safely
- `opencode` is recommended but not strictly required for installation
- `~/.claude` is optional; if it exists, the installer also registers Claude-compatible loaders

## For Humans

Paste this into your LLM agent session:

```
Install and configure OpenCode IMean by following the instructions here:
https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/docs/guide/installation.md
```

Or run the installer directly yourself:

```bash
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash
```

Useful installer flags:

```bash
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash -s -- --help
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash -s -- --dry-run
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash -s -- --uninstall
```

## For LLM Agents

If you are helping a user install OpenCode IMean, follow these steps.

Recommended prompt:

```text
Install OpenCode IMean for me by following this guide exactly:
https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/docs/guide/installation.md

Use the repository installer, preserve my existing config, verify the plugin is registered for OpenCode, and if ~/.claude exists, register it there too.
```

### Step 1: Verify prerequisites

Check whether OpenCode is already installed:

```bash
if command -v opencode >/dev/null 2>&1; then
  echo "OpenCode $(opencode --version) is installed"
else
  echo "OpenCode is not installed. Install OpenCode first: https://opencode.ai/docs"
fi
```

### Step 2: Run the installer

Use the repository installer directly:

```bash
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash
```

The installer will:

- clone or update the repository locally
- register `OpenCode IMean` in `~/.config/opencode/opencode.json` (or the active OpenCode config dir)
- register the plugin for Claude-compatible loaders when `~/.claude` is present
- preserve existing user config by merging instead of overwriting

### Step 3: Verify setup

```bash
command -v opencode >/dev/null 2>&1 && opencode --version || echo "opencode is not installed yet"
node -e 'const fs=require("node:fs");const os=require("node:os");const path=require("node:path");const configPath=process.env.OPENCODE_CONFIG_DIR?path.join(process.env.OPENCODE_CONFIG_DIR,"opencode.json"):path.join(process.env.XDG_CONFIG_HOME||path.join(os.homedir(),".config"),"opencode","opencode.json");const content=fs.readFileSync(configPath,"utf8");if(!content.includes("OpenCode-IMean/.opencode/plugins")){throw new Error("OpenCode IMean plugin not found in "+configPath)}console.log("OpenCode IMean registered in",configPath)'
```

If `~/.claude` exists, also check:

```bash
cat ~/.claude/plugins/installed_plugins.json
cat ~/.claude/settings.json
```

### Step 4: Start using the plugin

Launch OpenCode:

```bash
opencode
```

Then run the workflow:

```
/dispatch <goal>
/plan <goal-or-task-slug>
/tdd <task-slug>
/kickoff <task-slug>
/review <task-slug>
/verify <task-slug>
```

## Failure scenarios

- If `git` is missing, the installer exits immediately. Install Git first.
- If `node` is missing, the installer exits immediately. Install Node.js first.
- If `opencode` is missing, the installer still writes config, but you must install OpenCode from https://opencode.ai/docs before launching.
- If `~/.claude` is missing, Claude-compatible registration is skipped.
