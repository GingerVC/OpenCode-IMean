---
description: 执行 quick-fix 或已选 standardized 方案；必要时触发回退重规划。
agent: oh-imean:implementer
model: openai/gpt-5.2
argument-hint: 传入需求，或传入需求 + 已选方案（P1/P2/P3）
---
你正在运行 oh-imean 的 kickoff 命令（执行阶段）。

输入任务:
$ARGUMENTS

执行规则:
1. 先判断入口：
   - `standardized`：输入包含已选方案上下文（`P1/P2/P3` 或“已选方案”）
   - `quick-fix`：输入无已选方案，但目标明确且低歧义
2. `standardized` 必须读取并对齐：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/specs/<task-slug>/requirements.md`
   - `.oh-imean/specs/<task-slug>/plan.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
3. 若 `phase!=implement`、`selected_option/active_step` 缺失、handoff 缺失或冲突，直接返回 `replan request`，不进入实现。
4. 改动前先列出触达文件，按最小边界执行实现。
5. 完成实现后（两种模式一致）必须推进到 `review`：
   - `state.phase=review`
   - `state.current_role=implementer`
   - `state.next_role=reviewer`
   - runtime `recommended_next_command=/review <task-slug>`
   - 同步更新 `handoff.md` 与 `review.md`（可模板初始化）
6. 工件更新优先使用 `build-template-meta.js + write-artifact.js`。
7. 若出现计划/需求冲突或 `uncertainty=medium|high`，返回结构化 `replan request`：
   - 阻塞点
   - 涉及文件
   - 回退建议（`/plan <task-slug>`）
8. 输出简洁总结：已改文件、验证结果、剩余风险。

输出约束:
- 默认中文。
- 不输出冗长背景分析。
