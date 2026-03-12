'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const pluginModuleUrl = pathToFileURL(
  path.resolve(__dirname, '..', '.opencode', 'plugins', 'oh-imean.js')
).href;
const helpersModuleUrl = pathToFileURL(
  path.resolve(__dirname, '..', '.opencode', 'plugins', 'oh-imean-helpers.js')
).href;

function createTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'oh-imean-config-'));
}

function writeFile(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

test('OpenCode plugin exports wrapper with expected hook events', async () => {
  const pluginModule = await import(pluginModuleUrl);
  assert.deepEqual(Object.keys(pluginModule), ['default']);
  const plugin = await pluginModule.default({});
  assert.equal(typeof plugin.config, 'function');
  assert.equal(typeof plugin['session.created'], 'function');
  assert.equal(typeof plugin['session.idle'], 'function');
  assert.equal(typeof plugin['tool.execute.before'], 'function');
  assert.equal(typeof plugin['file.edited'], 'function');
});

test('OpenCode tool payload maps edit arguments to Claude-compatible hook payload', async () => {
  const { toClaudeToolPayload } = await import(helpersModuleUrl);
  assert.deepEqual(
    toClaudeToolPayload({
      tool: 'edit',
      args: { filePath: 'src/app.ts' },
    }),
    {
      tool_name: 'Edit',
      tool_input: { file_path: 'src/app.ts' },
      input: { filePath: 'src/app.ts' },
    },
  );
});

test('OpenCode config hook injects only OpenCode IMean plus skill and MCP sources', async () => {
  const { applyOhIMeanConfig } = await import(helpersModuleUrl);
  const pluginRoot = path.resolve(__dirname, '..');
  const workspace = createTempWorkspace();
  const globalConfigDir = path.join(workspace, 'opencode-config');
  const projectSkillsDir = path.join(workspace, '.opencode', 'skills');
  const globalSkillsDir = path.join(globalConfigDir, 'skills');
  writeFile(path.join(workspace, '.opencode', 'skills', 'project-skill', 'SKILL.md'), '# project skill\n');
  writeFile(path.join(workspace, '.opencode', 'skills', 'project-skill', 'mcp.json'), JSON.stringify({ 'project-skill-tool': { command: 'node', args: ['project-skill.js'] } }, null, 2));
  writeFile(path.join(globalConfigDir, 'opencode.json'), '{}');
  writeFile(path.join(globalConfigDir, 'skills', 'global-skill', 'SKILL.md'), '# global skill\n');
  writeFile(path.join(globalConfigDir, 'skills', 'global-skill', 'mcp.json'), JSON.stringify({ mcpServers: { 'global-skill-tool': { command: 'node', args: ['global-skill.js'] } } }, null, 2));
  writeFile(path.join(workspace, '.mcp.json'), JSON.stringify({ mcpServers: { 'project-local': { command: 'node', args: ['project-local.js'] } } }, null, 2));
  writeFile(path.join(workspace, '.claude', '.mcp.json'), JSON.stringify({ mcpServers: { 'claude-local': { command: 'node', args: ['claude-local.js'] } } }, null, 2));
  const previousCwd = process.cwd();
  const previousConfigDir = process.env.OPENCODE_CONFIG_DIR;
  process.chdir(workspace);
  process.env.OPENCODE_CONFIG_DIR = globalConfigDir;
  try {
    const config = {
      agent: { build: { description: 'existing' } },
      command: { existing: { template: 'noop' } },
      skills: ['existing-skill-source'],
      mcp: { websearch: { type: 'remote', url: 'https://override.example.com', enabled: false } },
    };
    applyOhIMeanConfig(config);
    assert.deepEqual(Object.keys(config.agent).sort(), ['OpenCode IMean', 'build']);
    assert.equal(config.agent['OpenCode IMean'].mode, 'primary');
    assert.equal(config.agent['OpenCode IMean'].tools.question, true);
    assert.equal(config.command.dispatch.agent, 'OpenCode IMean');
    assert.equal(config.command.plan.agent, 'OpenCode IMean');
    assert.equal(config.command.tdd.agent, 'OpenCode IMean');
    assert.equal(config.command.kickoff.agent, 'OpenCode IMean');
    assert.equal(config.command.review.agent, 'OpenCode IMean');
    assert.equal(config.command.verify.agent, 'OpenCode IMean');
    assert.match(config.command.dispatch.template, /spec 阶段/);
    assert.match(config.command.plan.template, /spec -> plan/);
    assert.deepEqual(config.skills.enable, ['existing-skill-source']);
    assert.deepEqual(config.skills.sources.map((entry) => fs.realpathSync.native(entry)), [
      fs.realpathSync.native(projectSkillsDir),
      fs.realpathSync.native(globalSkillsDir),
      fs.realpathSync.native(path.join(pluginRoot, 'skills')),
    ]);
    assert.deepEqual(config.mcp.websearch, { type: 'remote', url: 'https://override.example.com', enabled: false });
    assert.deepEqual(config.mcp.context7, { type: 'remote', url: 'https://mcp.context7.com/mcp', enabled: true });
    assert.deepEqual(config.mcp.grep_app, { type: 'remote', url: 'https://mcp.grep.app', enabled: true });
    assert.deepEqual(config.mcp['oh-ccbb-example'], { type: 'local', command: ['node', path.join(pluginRoot, 'mcp', 'example-server.js')], enabled: false });
    assert.deepEqual(config.mcp['project-local'], { type: 'local', command: ['node', 'project-local.js'], enabled: true });
    assert.deepEqual(config.mcp['claude-local'], { type: 'local', command: ['node', 'claude-local.js'], enabled: true });
    assert.deepEqual(config.mcp['project-skill-tool'], { type: 'local', command: ['node', 'project-skill.js'], enabled: true });
    assert.deepEqual(config.mcp['global-skill-tool'], { type: 'local', command: ['node', 'global-skill.js'], enabled: true });
  } finally {
    process.chdir(previousCwd);
    if (previousConfigDir === undefined) delete process.env.OPENCODE_CONFIG_DIR;
    else process.env.OPENCODE_CONFIG_DIR = previousConfigDir;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
