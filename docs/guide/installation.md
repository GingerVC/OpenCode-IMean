# Installation

## For Humans

Paste this into your LLM agent session:

```
Install and configure OpenCode IMean by following the instructions here:
https://raw.githubusercontent.com/vc999999999/OpenCode-IMean/main/docs/guide/installation.md
```

Or run the installer directly yourself:

```bash
curl -fsSL https://raw.githubusercontent.com/vc999999999/OpenCode-IMean/main/scripts/install.sh | bash
```

## For LLM Agents

If you are helping a user install OpenCode IMean, follow these steps.

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
curl -fsSL https://raw.githubusercontent.com/vc999999999/OpenCode-IMean/main/scripts/install.sh | bash
```

The installer will:

- clone or update the repository locally
- register `OpenCode IMean` in `~/.config/opencode/opencode.json` (or the active OpenCode config dir)
- register the plugin for Claude-compatible loaders when `~/.claude` is present
- preserve existing user config by merging instead of overwriting

### Step 3: Verify setup

```bash
opencode --version
cat ~/.config/opencode/opencode.json
```

The OpenCode config should contain a plugin entry pointing to:

```
/path/to/OpenCode-IMean/.opencode/plugins
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
