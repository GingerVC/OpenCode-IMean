# OpenCode IMean

[English README](./README.md)

OpenCode IMean 是一个面向 OpenCode、`oh-my-opencode` 以及 Claude Code 兼容加载器的本地优先工作流插件。

`OpenCode IMean` 不是官方 OpenCode 项目，而是社区维护的工作流插件。为了兼容现有命令、工件目录和 hook 脚本，内部 slug 仍然保留为 `oh-imean`。

## 一行安装

```bash
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash
```

这个安装器会：

- 在本地安装 OpenCode IMean
- 自动把插件注册到 OpenCode
- 在检测到 `~/.claude` 时自动注册到 oh-my-opencode / Claude 兼容加载器
- 尽量保留用户现有配置并做合并写入

## 前置要求

- `git`：安装器需要它来克隆或更新仓库
- `node`：安装器需要它来安全合并配置，并运行插件的 hook/runtime 脚本
- `opencode`：推荐预先安装。如果已经安装，安装完成后可以直接启动；如果没有安装，安装器仍然会写入配置，但你还需要先安装 OpenCode 才能运行 `opencode`
- `~/.claude`：可选。如果存在，安装器也会顺手注册 Claude 兼容加载器

## 安装

### 推荐（一行安装器）

```bash
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash
```

安装完成后运行：

```
opencode
```

### 验证安装成功

```bash
command -v opencode >/dev/null 2>&1 && opencode --version || echo "opencode 还没有安装"
node -e 'const fs=require("node:fs");const os=require("node:os");const path=require("node:path");const configPath=process.env.OPENCODE_CONFIG_DIR?path.join(process.env.OPENCODE_CONFIG_DIR,"opencode.json"):path.join(process.env.XDG_CONFIG_HOME||path.join(os.homedir(),".config"),"opencode","opencode.json");const content=fs.readFileSync(configPath,"utf8");if(!content.includes("OpenCode-IMean/.opencode/plugins")){throw new Error("没有在 "+configPath+" 里找到 OpenCode IMean 插件路径")}console.log("OpenCode IMean 已注册到",configPath)'
```

### 给 LLM 直接安装

把下面这句话直接贴给你的 LLM：

```
Install and configure OpenCode IMean by following the instructions here:
https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/docs/guide/installation.md
```

### 给 LLM 的标准提示词

如果你想让 LLM 直接执行安装，而不是只做摘要，建议用这段：

```text
Install OpenCode IMean for me by following this guide exactly:
https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/docs/guide/installation.md

Use the repository installer, preserve my existing config, verify the plugin is registered for OpenCode, and if ~/.claude exists, register it there too.
```

### 安装器参数

```bash
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash -s -- --help
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash -s -- --dry-run
curl -fsSL https://raw.githubusercontent.com/GingerVC/OpenCode-IMean/main/scripts/install.sh | bash -s -- --uninstall
```

### 手动安装

把插件路径注册到你的 `opencode.json`：

```json
{
  "plugin": [
    "/path/to/OpenCode-IMean/.opencode/plugins"
  ]
}
```

说明：

- commands 和 roles 都由插件的 `config` hook 动态注入
- 不需要手动复制 `agent` 或 `command` 配置块
- OpenCode IMean 目前使用基于仓库的安装方式

### Claude / oh-my-opencode 手动注册

把仓库加入：

```
~/.claude/plugins/installed_plugins.json
```

其中 `installPath` 指向仓库根目录。

然后在这里启用：

```
~/.claude/settings.json
```

### 常见失败场景

- 如果缺少 `git`，安装器会立即退出。先安装 Git，再重新执行命令。
- 如果缺少 `node`，安装器会立即退出。先安装 Node.js，再重新执行命令。
- 如果缺少 `opencode`，安装器仍然会写入配置，但你还需要先去 [opencode.ai/docs](https://opencode.ai/docs) 安装 OpenCode，之后才能启动插件。
- 如果不存在 `~/.claude`，Claude 兼容注册会被跳过，但 OpenCode 注册仍然会成功。

## 快速开始

1. 先用启用了 `OpenCode IMean` 的 OpenCode 会话进入项目。
2. 运行 `/dispatch <目标>`，创建任务并进入 `spec`。
3. 运行 `/plan <目标或task-slug>`，锁定需求并生成实现计划。
4. 运行 `/tdd <task-slug>`，先写失败测试并确认 RED。
5. 运行 `/kickoff <task-slug>`，在 TDD 之后进入实现。
6. 最后执行 `/review <task-slug>` 和 `/verify <task-slug>`。

规则：

- 所有任务都遵循 `spec -> plan -> tdd -> implement -> review -> verify`
- `OpenCode IMean` 是唯一可见角色，`spec/plan/tdd` 都只是它内部的阶段
- 托管 `skills` 和合并后的 `mcp` 配置都会自动挂到这个角色上

## 它解决什么问题

OpenCode IMean 的目标不是单纯“给模型更多上下文”，而是优化一类常见模型：

- 上下文窗口很大
- 调用成本比较低
- 但容易在长流程里走歪

这类模型通常不是“看不到信息”，而是：

- 需求还没锁定就开始写代码
- 把探索信息、旧上下文和当前任务状态混在一起
- 忘记自己当前处于哪个阶段
- 看起来说得很多，但其实已经偏离主目标
- 没经过 review / verify 就自认为任务完成

所以 OpenCode IMean 的核心思路是：

- 把任务状态外置到工件
- 强制阶段切换
- 把 `spec/plan` 和实现拆开
- 最小化无效上下文在阶段之间的延续

## 核心设计

- 固定流程：`dispatch -> spec -> plan -> tdd -> kickoff -> review -> verify`
- 依赖工件保存状态，而不是依赖会话记忆
- 新会话可以从工件恢复任务
- hooks 负责做 phase gate 和轻量质量检查

## 仓库结构

- `.claude-plugin/plugin.json`：Claude 兼容插件清单
- `.opencode/opencode.json`：原生 OpenCode 入口
- `.opencode/plugins/`：原生 OpenCode 插件包装层
- `agents/`：单角色 workflow prompt
- `commands/`：slash command prompt
- `hooks/`：hook 映射
- `scripts/lib/`：共享 runtime 工具
- `scripts/hooks/`：生命周期 hook 与质量检查逻辑
- `skills/`：仓库内自包含技能
- `.mcp.json`：MCP 模板/参考配置

## 工作流

### Standardized

适用于：

- 新功能
- 跨模块改动
- 需求边界还没锁定
- 需要先明确验收标准的任务

流程：

- `/dispatch <目标>`
- `/plan <目标或task-slug>`
- `/tdd <task-slug>`
- `/kickoff <task-slug>`
- `/review <task-slug>`
- `/verify <task-slug>`

固定规则：

- 所有需求都先进入 `spec`，再进入 `plan`，然后固定执行 `tdd`，之后才允许实现

## 角色设计

单一可见角色：

- `OpenCode IMean`：插件唯一暴露的角色
- `spec`、`plan`、`tdd`、`implement`、`review`、`verify`：都只是 `OpenCode IMean` 内部的工作流阶段，不是独立角色

说明：

- slash commands 仍然按阶段拆分，但所有命令都运行在 `OpenCode IMean`
- `handoff.md` 现在表示 `OpenCode IMean` 内部的阶段交接点，而不是角色委托
- 托管 `skills` 和合并后的 `mcp` 配置也都挂在 `OpenCode IMean` 上，由插件 `config` hook 统一注入

## 为什么它适合容易走歪的模型

这个插件最关键的优化点不是“更多上下文”，而是“更少漂移”。

它会把下一步真正需要的最小状态写出来，而不是指望模型自己记住：

- 当前阶段
- 当前任务身份
- 当前选中的方案
- 当前执行步骤
- 下一角色
- 下一条推荐命令
- 最近一次 review / verify 结果

同时它要求统一裁剪规则：

- `Read -> Judge -> Keep/Drop`
- `Explore locally, persist minimally`

所以它本质上是在压制这类模型最常见的问题：阶段漂移、状态漂移、目标漂移。

## 任务工件

每个任务目录至少包含：

- `.oh-imean/specs/<task-slug>/state.json`
- `.oh-imean/specs/<task-slug>/handoff.md`
- `.oh-imean/specs/<task-slug>/review.md`
- `.oh-imean/specs/<task-slug>/verification.md`

`standardized` 额外包含：

- `.oh-imean/specs/<task-slug>/requirements.md`
- `.oh-imean/specs/<task-slug>/plan.md`

运行时工件：

- `.oh-imean/runtime/tasks/<task-slug>.json`
- `.oh-imean/runtime/sessions/<date>-<session-id>.md`
- `.oh-imean/runtime/logs/oh-imean-hook.log`

说明：

- `.oh-imean/` 是运行时生成目录，不纳入 git
- `state.json` 是流程真相源
- `runtime/tasks/*.json` 是恢复摘要层
- `handoff.md` 是阶段交接层

## Hook 行为

当前 hooks 用 Node.js 实现：

- `session.created`：恢复最近活跃任务摘要
- `session.idle`：写入 session summary
- `tool.execute.before`：在源码编辑前做 phase gate
- `file.edited`：编辑后执行轻量质量检查

Hook profile：

- `minimal`
- `standard`
- `strict`

默认建议：

- fixed workflow default: `standard`
- `standardized -> standard`

环境变量：

- `OH_IMEAN_HOOK_PROFILE=minimal|standard|strict`
- `OH_IMEAN_DISABLED_HOOKS=<comma-separated ids>`
- `OH_IMEAN_QUALITY_GATE_FIX=true|false`
- `OH_IMEAN_QUALITY_GATE_STRICT=true|false`

## 仓库内技能

当前仓库只保留自包含、可直接开源发布的技能：

- `frontend-ui-ux`
- `git-master`
- `playwright`
- `repo-guard`

原生 OpenCode wrapper 现在会自动把三类技能目录注入到 `config.skills`：项目级 `.opencode/skills`、全局 `~/.config/opencode/skills`，以及插件自身的 `skills/`。你原有的 `config.skills` 配置仍会保留，并排在这些托管来源之前。这些托管技能最终都由唯一角色 `OpenCode IMean` 使用。

## MCP 配置

`oh-imean` 现在会自动合并 MCP 来源：插件自带 `.mcp.json`、项目根 `.mcp.json`、项目 `.claude/.mcp.json`，以及上述技能目录内各个 skill 的 `mcp.json`。合并后的 MCP 能力统一暴露给唯一角色 `OpenCode IMean`。

当前定义：

- `websearch`
- `context7`
- `grep_app`

预期环境变量：

- `EXA_API_KEY`：用于 `websearch`
- `CONTEXT7_API_KEY`：用于 `context7`，取决于你的部署方式
- `GITHUB_TOKEN`：用于 `grep_app`

安全要求：

- 不要提交真实 API Key
- 不要把密钥硬编码到 `.mcp.json`
- 优先使用环境变量或本地私有密钥文件

## 备注

- 默认工作流语言是中文
- 原生 OpenCode 支持位于 `.opencode/`
- 插件会桥接到现有 Node hook 和工件系统
- 这个项目的优化重点是让容易走歪的模型更守流程，而不是让智能体拥有更大的自由度
