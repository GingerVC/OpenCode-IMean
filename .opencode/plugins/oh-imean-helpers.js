import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pluginRoot = path.resolve(__dirname, "../..")
const CLAUDE_PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}"
const PLUGIN_SKILLS_SOURCE_PATH = path.join(pluginRoot, "skills")
const RUNTIME_TASKS_DIR = ".oh-imean/runtime/tasks"
const SPECS_DIR = ".oh-imean/specs"

const TOOL_NAME_MAP = {
  edit: "Edit",
  write: "Write",
  multiedit: "MultiEdit",
}

const FILE_ARG_KEYS = ["filePath", "file_path", "path"]
const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---\n?/
const RESEARCH_MCPS = ["websearch", "context7"]
const PRIMARY_AGENT_NAME = "OpenCode IMean"

const readText = (relativePath) =>
  fs.readFileSync(path.join(pluginRoot, relativePath), "utf8")

const stripFrontmatter = (value) => value.replace(FRONTMATTER_PATTERN, "").trim()

const readPrompt = (relativePath) => stripFrontmatter(readText(relativePath))

const readTemplate = (relativePath) => `${readText(relativePath).trim()}\n\n$ARGUMENTS`

const resolvePluginPaths = (value) => {
  if (value === null || value === undefined) return value

  if (typeof value === "string") {
    return value.replace(CLAUDE_PLUGIN_ROOT_VAR, pluginRoot)
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolvePluginPaths(item))
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolvePluginPaths(item)]),
    )
  }

  return value
}

const pathExists = (targetPath) => {
  try {
    return fs.existsSync(targetPath)
  } catch {
    return false
  }
}

const isDirectory = (targetPath) => {
  try {
    return fs.statSync(targetPath).isDirectory()
  } catch {
    return false
  }
}

const uniquePaths = (paths) => [...new Set(paths.filter(Boolean))]

const getOpenCodeConfigDir = () => {
  const envConfigDir = process.env.OPENCODE_CONFIG_DIR?.trim()
  if (envConfigDir) {
    return path.resolve(envConfigDir)
  }

  if (process.platform === "win32") {
    const crossPlatformDir = path.join(os.homedir(), ".config", "opencode")
    const crossPlatformConfig = path.join(crossPlatformDir, "opencode.json")

    if (pathExists(crossPlatformConfig)) {
      return crossPlatformDir
    }

    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
    const appDataDir = path.join(appData, "opencode")
    const appDataConfig = path.join(appDataDir, "opencode.json")

    if (pathExists(appDataConfig)) {
      return appDataDir
    }

    return crossPlatformDir
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
  return path.join(xdgConfig, "opencode")
}

const getOpenCodeProjectSkillsDir = () => path.join(process.cwd(), ".opencode", "skills")
const getOpenCodeGlobalSkillsDir = () => path.join(getOpenCodeConfigDir(), "skills")

const getManagedSkillSourcesLowToHigh = () => uniquePaths([
  PLUGIN_SKILLS_SOURCE_PATH,
  getOpenCodeGlobalSkillsDir(),
  getOpenCodeProjectSkillsDir(),
].filter(isDirectory))

const getManagedSkillSourcesHighToLow = () => [...getManagedSkillSourcesLowToHigh()].reverse()

const readJsonFile = (filePath) => {
  if (!pathExists(filePath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return null
  }
}

const extractMcpServers = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  if (value.mcpServers && typeof value.mcpServers === "object" && !Array.isArray(value.mcpServers)) {
    return value.mcpServers
  }

  const looksLikeDirectMcpMap = Object.values(value).some((entry) => (
    entry && typeof entry === "object" && !Array.isArray(entry) && (
      "command" in entry || "url" in entry || "type" in entry
    )
  ))

  return looksLikeDirectMcpMap ? value : {}
}

const loadMcpServersFromFile = (filePath) => resolvePluginPaths(extractMcpServers(readJsonFile(filePath)))

const listSkillDirectories = (skillSource) => {
  if (!isDirectory(skillSource)) return []

  return fs.readdirSync(skillSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillSource, entry.name))
}

const loadSkillScopedMcpServers = (skillSources) => {
  const servers = {}

  for (const skillSource of skillSources) {
    for (const skillDir of listSkillDirectories(skillSource)) {
      Object.assign(servers, loadMcpServersFromFile(path.join(skillDir, "mcp.json")))
    }
  }

  return servers
}

const normalizeMcpServers = (rawServers, currentPhase) => {
  if (!rawServers || typeof rawServers !== "object") {
    return {}
  }

  return Object.fromEntries(
    Object.entries(rawServers).flatMap(([name, rawServer]) => {
      if (!rawServer || typeof rawServer !== "object") {
        return []
      }

      const server = resolvePluginPaths(rawServer)
      const serverType = server.type || "stdio"
      let enabled = server.disabled !== true

      if (enabled && RESEARCH_MCPS.includes(name) && currentPhase === "implement") {
        enabled = false
      }

      if (serverType === "http" || serverType === "sse") {
        if (typeof server.url !== "string" || !server.url.trim()) {
          return []
        }

        return [[
          name,
          {
            type: "remote",
            url: server.url,
            ...(server.headers && Object.keys(server.headers).length > 0
              ? { headers: server.headers }
              : {}),
            enabled,
          },
        ]]
      }

      if (typeof server.command !== "string" || !server.command.trim()) {
        return []
      }

      return [[
        name,
        {
          type: "local",
          command: [server.command, ...(Array.isArray(server.args) ? server.args : [])],
          ...(server.env && Object.keys(server.env).length > 0
            ? { environment: server.env }
            : {}),
          enabled,
        },
      ]]
    }),
  )
}

const buildPrimaryAgents = () => ({
  [PRIMARY_AGENT_NAME]: {
    description: "Single fixed workflow agent for oh-imean.",
    mode: "primary",
    prompt: readPrompt("agents/workflow.md"),
    tools: {
      read: true,
      bash: true,
      question: true,
      write: true,
      edit: true,
      mcp: true,
    },
  },
})

const buildInjectedCommands = () => ({
  dispatch: {
    description: "Initialize a new task and enter spec.",
    template: readTemplate("commands/dispatch.md"),
    agent: PRIMARY_AGENT_NAME,
    subtask: true,
  },
  plan: {
    description: "Lock spec, write the implementation plan, then advance to tdd.",
    template: readTemplate("commands/plan.md"),
    agent: PRIMARY_AGENT_NAME,
    subtask: true,
  },
  tdd: {
    description: "Write failing tests before implementation.",
    template: readTemplate("commands/tdd.md"),
    agent: PRIMARY_AGENT_NAME,
    subtask: true,
  },
  kickoff: {
    description: "Implement after tdd is complete.",
    template: readTemplate("commands/kickoff.md"),
    agent: PRIMARY_AGENT_NAME,
    subtask: true,
  },
  review: {
    description: "Review implementation results before verification.",
    template: readTemplate("commands/review.md"),
    agent: PRIMARY_AGENT_NAME,
    subtask: true,
  },
  verify: {
    description: "Run final verification and write verification artifacts.",
    template: readTemplate("commands/verify.md"),
    agent: PRIMARY_AGENT_NAME,
    subtask: true,
  },
  resume: {
    description: "Resume the latest active task and show the next recommended command.",
    template: readTemplate("commands/resume.md"),
    agent: PRIMARY_AGENT_NAME,
    subtask: true,
  },
  status: {
    description: "Summarize task state, review status, verification status, and blockers.",
    template: readTemplate("commands/status.md"),
    agent: PRIMARY_AGENT_NAME,
    subtask: true,
  },
  "quality-gate": {
    description: "Run the lightweight quality gate on a file or repo scope.",
    template: readTemplate("commands/quality-gate.md"),
    agent: PRIMARY_AGENT_NAME,
    subtask: true,
  },
})

const getLatestTaskPhase = () => {
  try {
    const specsRoot = path.join(process.cwd(), SPECS_DIR)
    if (!fs.existsSync(specsRoot)) return null

    const taskDirs = fs
      .readdirSync(specsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    let latestTask = null
    let latestTime = 0

    for (const taskSlug of taskDirs) {
      const statePath = path.join(specsRoot, taskSlug, "state.json")
      if (fs.existsSync(statePath)) {
        const stat = fs.statSync(statePath)
        if (stat.mtimeMs > latestTime) {
          latestTime = stat.mtimeMs
          const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
          latestTask = state
        }
      }
    }

    if (!latestTask) return null
    if (["done"].includes(latestTask.phase)) return null
    if (["active", "waiting_user", "blocked"].includes(latestTask.status)) {
      return latestTask.phase
    }
    return null
  } catch {
    return null
  }
}

const buildInjectedMcpServers = () => {
  const currentPhase = getLatestTaskPhase()
  const rawServers = {
    ...loadMcpServersFromFile(path.join(pluginRoot, ".mcp.json")),
    ...loadMcpServersFromFile(path.join(process.cwd(), ".mcp.json")),
    ...loadMcpServersFromFile(path.join(process.cwd(), ".claude", ".mcp.json")),
    ...loadSkillScopedMcpServers(getManagedSkillSourcesLowToHigh()),
  }

  return normalizeMcpServers(rawServers, currentPhase)
}

const toSourcePath = (source) => {
  if (typeof source === "string") return source
  if (source && typeof source === "object" && typeof source.path === "string") return source.path
  return null
}

const mergeSkillSources = (existingSkills) => {
  const managedSources = getManagedSkillSourcesHighToLow()

  if (!existingSkills) {
    return {
      sources: managedSources,
    }
  }

  if (Array.isArray(existingSkills)) {
    return {
      enable: existingSkills,
      sources: managedSources,
    }
  }

  const existingSources = Array.isArray(existingSkills.sources) ? existingSkills.sources : []
  const existingSourcePaths = new Set(existingSources.map(toSourcePath).filter(Boolean))
  const missingSources = managedSources.filter((source) => !existingSourcePaths.has(source))

  return {
    ...existingSkills,
    sources: [...existingSources, ...missingSources],
  }
}

export const applyOhIMeanConfig = (config) => {
  config.agent = {
    ...(config.agent || {}),
        ...buildPrimaryAgents(),
  }

  config.command = {
    ...(config.command || {}),
    ...buildInjectedCommands(),
  }

  config.skills = mergeSkillSources(config.skills)

  config.mcp = {
    ...buildInjectedMcpServers(),
    ...(config.mcp || {}),
  }
}

const normalizeToolName = (tool) => {
  const raw = String(tool || "").trim()
  if (!raw) return ""
  return TOOL_NAME_MAP[raw.toLowerCase()] || raw
}

const getFilePath = (args) => {
  if (!args || typeof args !== "object") return ""
  for (const key of FILE_ARG_KEYS) {
    const value = args[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return ""
}

export const toClaudeToolPayload = (input = {}) => {
  const toolName = normalizeToolName(input.tool)
  const filePath = getFilePath(input.args)
  const payload = {
    tool_name: toolName,
    tool_input: {},
  }

  if (filePath) {
    payload.tool_input.file_path = filePath
  }

  if (input.args && typeof input.args === "object") {
    payload.input = input.args
  }

  return payload
}
