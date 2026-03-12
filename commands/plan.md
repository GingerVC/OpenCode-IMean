---
description: 固定先完成 spec，再产出 plan，并把任务推进到 tdd。
agent: "OpenCode IMean"
model: openai/gpt-5.2
argument-hint: 描述要实现的功能、修复或重构目标
---
你正在运行 oh-imean 的 plan 命令（spec -> plan 阶段）。

任务输入:
$ARGUMENTS

固定流程:
1. 进入 plan 命令后，必须先执行 `spec mode`，再执行 `plan mode`。
2. `spec mode`：
   - 读取并复用已有 `task-slug` 与工件。
   - 先产出第一版 `requirements.md`。
   - 只补最少关键问题，不把 spec 退化成纯问答。
   - 在需求未锁定前，不进入实现方案细节。
3. `plan mode`：
   - 基于已确认 spec 产出单一可执行计划。
   - 必须写入 `.oh-imean/specs/<task-slug>/plan.md`。
   - 计划完成后固定推进到 `tdd`，不允许 direct kickoff。
4. 必须维护：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/requirements.md`
   - `.oh-imean/specs/<task-slug>/plan.md`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
5. 计划结束后，state/runtime 至少写成：
   - `phase=tdd`
   - `status=active`
   - `current_role=OpenCode IMean`
   - `next_role=OpenCode IMean`
   - `recommended_next_command=/tdd <task-slug>`
6. 输出中必须清楚分开：
   - `spec summary`
   - `assumptions`
   - `open questions`
   - `implementation plan`
   - `next command`

输出约束:
- 默认中文。
- 只输出单一计划，不制造 P1/P2/P3。
- 必须包含：`task-slug`、`phase=tdd`、工件路径、执行步骤、验证清单、replan 条件。
