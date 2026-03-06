---
description: 恢复最近一次活跃任务，并给出下一步命令。
agent: oh-imean:dispatcher
model: openai/gpt-5.2
argument-hint: 可选传入 task-slug；留空则恢复最近活跃任务
---
你正在运行 oh-imean 的 resume 命令（恢复阶段）。

任务输入:
$ARGUMENTS

固定流程:
1. 优先读取 `.oh-imean/runtime/tasks/` 下的 runtime task 摘要。
2. 若用户传入 `task-slug`，优先恢复该任务；否则恢复最近一次活跃任务。
3. 恢复时必须按顺序读取：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/specs/<task-slug>/requirements.md`
   - `.oh-imean/specs/<task-slug>/plan.md`
   - `.oh-imean/specs/<task-slug>/review.md`
   - `.oh-imean/specs/<task-slug>/verification.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
4. 输出必须聚焦恢复，不重新规划、不新建任务、不进入实现。
5. 若任务不存在、工件缺失或状态冲突，输出结构化阻塞，并给出推荐回退命令。

输出约束:
- 默认中文。
- 必须包含：
  - `task-slug`
  - `phase`
  - `selected_option`
  - `active_step`
  - `review_status`
  - `verification_status`
  - `recommended_next_command`
  - `artifacts`
  - `blocking_reason`（若有）
