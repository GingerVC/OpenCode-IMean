import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { applyOhIMeanConfig, toClaudeToolPayload } from "./oh-imean-helpers.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pluginRoot = path.resolve(__dirname, "../..")

const runNodeScript = (scriptPath, scriptArgs = [], payload, options = {}) => {
  const cwd = options.cwd || process.cwd()
  const env = {
    ...process.env,
    ...options.env,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
  }

  return spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    input: payload ? JSON.stringify(payload) : "",
    encoding: "utf8",
    cwd,
    env,
  })
}

const runHookScript = (relativeScriptPath, payload, options = {}) =>
  runNodeScript(path.join(pluginRoot, relativeScriptPath), [], payload, options)

const runManagedHook = (hookId, relativeScriptPath, profilesCsv, payload, options = {}) =>
  runNodeScript(
    path.join(pluginRoot, "scripts/hooks/run-hook.js"),
    [hookId, relativeScriptPath, profilesCsv],
    payload,
    options,
  )

const createLogger = (client) => {
  if (!client?.app?.log) {
    return () => {}
  }

  return (level, message) =>
    client.app.log({
      body: {
        service: "oh-imean",
        level,
        message,
      },
    })
}

const emitHookOutput = (log, result, label) => {
  if (result.stderr?.trim()) {
    log("warn", `[${label}] ${result.stderr.trim()}`)
  }
  if (result.stdout?.trim()) {
    log("info", `[${label}] ${result.stdout.trim()}`)
  }
}

const OhIMeanPlugin = async ({ client, worktree }) => {
  const log = createLogger(client)

  return {
    config: async (config) => {
      applyOhIMeanConfig(config)
    },

    "session.created": async (event = {}) => {
      const result = runManagedHook(
        "session:start",
        "scripts/hooks/session-start.js",
        "minimal,standard,strict",
        event,
        { cwd: worktree },
      )
      emitHookOutput(log, result, "session.created")
    },

    "session.idle": async (event = {}) => {
      const payload = {
        ...event,
        session_id: event.session_id || event.id || "opencode-session",
      }
      const result = runManagedHook(
        "stop:session-summary",
        "scripts/hooks/session-stop.js",
        "minimal,standard,strict",
        payload,
        { cwd: worktree },
      )
      emitHookOutput(log, result, "session.idle")
    },

    "tool.execute.before": async (input = {}) => {
      const payload = toClaudeToolPayload(input)
      if (!["Edit", "Write", "MultiEdit"].includes(payload.tool_name)) {
        return
      }

      const result = runManagedHook(
        "pre:phase-gate",
        "scripts/hooks/pre-tool-use.js",
        "standard,strict",
        payload,
        { cwd: worktree },
      )
      emitHookOutput(log, result, "tool.execute.before")
      if ((result.status ?? 0) !== 0) {
        throw new Error(result.stderr?.trim() || "oh-imean phase gate blocked the edit")
      }
    },

    "file.edited": async (event = {}) => {
      if (!event.path) return

      const result = runManagedHook(
        "post:quality-gate",
        "scripts/hooks/quality-gate.js",
        "standard,strict",
        {
          tool_name: "Edit",
          tool_input: {
            file_path: event.path,
          },
        },
        { cwd: worktree }
      )
      emitHookOutput(log, result, "file.edited")
    },
  }
}

export default OhIMeanPlugin
