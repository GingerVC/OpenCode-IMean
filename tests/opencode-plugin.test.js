'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const pluginModuleUrl = pathToFileURL(
  path.resolve(__dirname, '..', '.opencode', 'plugins', 'oh-imean.js')
).href;
const helpersModuleUrl = pathToFileURL(
  path.resolve(__dirname, '..', '.opencode', 'plugins', 'oh-imean-helpers.js')
).href;

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
      args: {
        filePath: 'src/app.ts',
      },
    }),
    {
      tool_name: 'Edit',
      tool_input: {
        file_path: 'src/app.ts',
      },
      input: {
        filePath: 'src/app.ts',
      },
    }
  );
});

test('OpenCode config hook injects oh-imean agents and commands', async () => {
  const { applyOhIMeanConfig } = await import(helpersModuleUrl);
  const pluginRoot = path.resolve(__dirname, '..');
  const config = {
    agent: {
      build: { description: 'existing' },
    },
    command: {
      existing: { template: 'noop' },
    },
    skills: ['existing-skill-source'],
    mcp: {
      websearch: { type: 'remote', url: 'https://override.example.com', enabled: false },
    },
  };

  applyOhIMeanConfig(config);

  assert.equal(typeof config.agent['oh-imean-dispatcher'].prompt, 'string');
  assert.equal(config.agent['oh-imean-dispatcher'].mode, 'all');
  assert.equal(config.agent['oh-imean-spec-planner'].mode, 'all');
  assert.equal(config.agent['oh-imean-tdd-writer'].mode, 'all');
  assert.equal(config.agent['oh-imean-implementer'].mode, 'all');
  assert.equal(config.agent['oh-imean-reviewer'].mode, 'all');
  assert.equal(config.agent['oh-imean-verifier'].mode, 'all');
  assert.equal(config.agent['oh-imean-dispatcher'].tools.question, true);
  assert.equal(config.agent['oh-imean-spec-planner'].tools.question, true);
  assert.equal(config.agent['OpenCode iMean'].mode, 'primary');
  assert.equal(config.agent['OpenCode iMean'].tools.question, true);
  assert.equal(config.agent.build.description, 'existing');
  assert.equal(config.command.dispatch.agent, 'oh-imean-dispatcher');
  assert.equal(config.command.tdd.agent, 'oh-imean-tdd-writer');
  assert.equal(config.command.existing.template, 'noop');
  assert.match(config.command.dispatch.template, /你正在运行 oh-imean 的 dispatch 命令/);
  assert.match(config.command.tdd.template, /你正在运行 oh-imean 的 tdd 命令/);
  assert.deepEqual(config.skills, {
    enable: ['existing-skill-source'],
    sources: [path.join(pluginRoot, 'skills')],
  });
  assert.deepEqual(config.mcp.websearch, {
    type: 'remote',
    url: 'https://override.example.com',
    enabled: false,
  });
  assert.deepEqual(config.mcp.context7, {
    type: 'remote',
    url: 'https://mcp.context7.com/mcp',
    enabled: true,
  });
  assert.deepEqual(config.mcp.grep_app, {
    type: 'remote',
    url: 'https://mcp.grep.app',
    enabled: true,
  });
  assert.deepEqual(config.mcp['oh-ccbb-example'], {
    type: 'local',
    command: ['node', path.join(pluginRoot, 'mcp', 'example-server.js')],
    enabled: false,
  });
});
