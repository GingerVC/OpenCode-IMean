---
description: 统一调度入口，先判断走标准化流程还是快速修复。
agent: oh-imean:dispatcher
model: openai/gpt-5.2
argument-hint: 描述你的需求、问题或计划
---
你正在运行 oh-imean 的 dispatch 命令（统一调度阶段）。

任务输入:
$ARGUMENTS

固定流程:
0. `hook_profile` 只允许写入 `minimal|standard|strict`。
   - `quick-fix` 默认映射为 `minimal`
   - `standardized` 默认映射为 `standard`
   - 只有用户明确要求更强护栏时才使用 `strict`
   - 绝不能把流程模式名（如 `quick-fix` / `standardized`）直接写进 `hook_profile`
1. 先判断用户是否已经明确说明使用 `standardized` 或 `quick-fix`。
2. 若未明确说明，先由你基于任务复杂度和歧义程度自动判定默认模式：
   - `quick-fix`：单点修复、已有明确报错、低歧义、小范围改动
   - `standardized`：新功能、跨模块变更、需求不稳、需要先对齐验收标准
3. 只有在你无法可靠判定时，才使用 `question` / `ask_user_question` / `askuserquestion` 之一询问用户选择模式。
4. 若模式为 `standardized`：
   - 先判断是复用已有 `task-slug` 还是创建新 `task-slug`。
   - 优先使用 artifact writer 创建或更新 `.oh-imean/specs/<task-slug>/state.json`。
   - 同步用 artifact writer 创建或更新 `.oh-imean/runtime/tasks/<task-slug>.json`。
   - 生成 state/runtime patch 时，优先使用 wrapper：
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" dispatch-state <task-slug> --mode standardized --phase intake --status active --current-role dispatcher --next-role spec-planner --uncertainty <low|medium|high> --goal "<需求摘要>" --recommended-next-command "/plan <task-slug>" --out <state-patch>`
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" dispatch-runtime <task-slug> --phase intake --hook-profile <profile> --recommended-next-command "/plan <task-slug>" --last-blocking-reason "<none|reason>" --out <runtime-patch>`
   - 可选地预创建 `handoff.md` 模板，给后续 `/plan` 直接复用。
   - 生成 handoff 的 `meta-file` 时，优先使用 wrapper：
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" dispatch-handoff <task-slug> --phase intake --from-role dispatcher --to-role spec-planner --next-action "运行 /plan <task-slug>" --out <meta-file>`
   - artifact writer 用法：
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" state <task-slug> --merge-file <state-patch>`
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" runtime <task-slug> --merge-file <runtime-patch>`
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" handoff <task-slug> --template --meta-file <meta-file>`
   - `state.json` 至少写入：`mode=standardized`、`phase=intake`、`status=active`、`current_role=dispatcher`、`next_role=spec-planner`、`uncertainty_level`。
   - `runtime/tasks/<task-slug>.json` 至少写入：`task_slug`、`phase=intake`、`hook_profile=standard`（或用户明确指定的 `strict`）、`recommended_next_command`、`last_blocking_reason`。
   - 不进入代码实现。
   - 明确引导进入 `/plan <需求>` 或 `/resume <task-slug>`。
5. 若模式为 `quick-fix`：
   - 也必须创建或复用 `task-slug`，并写入 `.oh-imean/specs/<task-slug>/state.json`、`.oh-imean/specs/<task-slug>/handoff.md` 与 `.oh-imean/runtime/tasks/<task-slug>.json`。
   - state patch 至少包含：`mode=quick-fix`、`phase=implement`、`status=active`、`current_role=dispatcher`、`next_role=implementer`、`current_goal`、`uncertainty_level`、`recommended_next_command=/kickoff <task-slug>`。
   - runtime patch 至少包含：`mode=quick-fix`、`phase=implement`、`hook_profile=minimal`、`recommended_next_command=/kickoff <task-slug>`、`last_blocking_reason`。
   - handoff 只保留当前修复目标、假设、未决问题、下一步。
   - 不在当前命令里直接实施修改。
   - 明确引导进入 `/kickoff <task-slug>`。
6. 采用 `Read -> Judge -> Keep/Drop`：
   - 允许有限探索帮助判模
   - 只把路由结论、理由、下一角色、任务标识写入状态工件与 runtime task
   - 无关探索结果不要带到下一阶段

输出约束:
- 默认中文。
- 只做模式分流、阶段说明和下一步指引，不扩展实现细节。
- 输出中必须包含：
  - 判定模式
  - 当前阶段（`intake`）
  - `task-slug`（若 standardized 且已知）
  - `next-role`
  - `uncertainty`
  - 判定理由
  - 下一步命令
