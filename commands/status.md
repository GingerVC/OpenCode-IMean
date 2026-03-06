---
description: 汇总当前任务的 phase、最近验证状态与 replan 风险。
agent: oh-imean:dispatcher
model: openai/gpt-5.2
argument-hint: 可选传入 task-slug；留空则读取最近活跃任务
---
你正在运行 oh-imean 的 status 命令（状态总览）。

任务输入:
$ARGUMENTS

固定流程:
1. 优先读取 `.oh-imean/runtime/tasks/` 下的 runtime task 摘要。
2. 若用户传入 `task-slug`，优先读取对应任务；否则读取最近活跃任务。
3. 按顺序读取：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/specs/<task-slug>/review.md`（若存在）
   - `.oh-imean/runtime/tasks/<task-slug>.json`
   - `.oh-imean/specs/<task-slug>/verification.md`（若存在）
4. 输出当前 phase、最近 review 状态、最近验证状态、是否存在 replan 风险。
5. 不做新建、不做重规划、不进入实现。

输出约束:
- 默认中文。
- 必须包含：
  - `task-slug`
  - `phase`
  - `selected_option`
  - `active_step`
  - `review_status`
  - `verification_status`
  - `last_blocking_reason`
  - `replan_risk`
  - `recommended_next_command`
