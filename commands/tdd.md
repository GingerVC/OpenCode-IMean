---
description: 在 standardized 流程中先写失败测试，再进入实现阶段。
agent: oh-imean:tdd-writer
model: openai/gpt-5.2
argument-hint: 传入 task-slug，基于已选方案补齐 RED 阶段测试
---
你正在运行 oh-imean 的 tdd 命令（测试先行阶段）。

输入任务:
$ARGUMENTS

执行规则:
1. 只服务 `standardized` 流程；必须先读取：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/specs/<task-slug>/requirements.md`
   - `.oh-imean/specs/<task-slug>/plan.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
2. 只有在 `execution_lane=tdd` 时才允许继续；若 `phase!=tdd`、`selected_option/active_step` 缺失、handoff 缺失或冲突，直接返回结构化阻塞，不进入测试编写。
3. 只允许编写或更新测试与必要测试夹具；禁止实现生产代码、禁止偷偷把测试写成通过态。
4. 必须运行最小必要测试命令，并确认结果为预期的 `RED`：
   - 测试失败原因应与目标能力未实现一致
   - 若测试已通过，说明计划或测试设计有问题，必须停下并说明
5. RED 确认后，必须推进到实现阶段：
   - `state.phase=implement`
   - `state.current_role=tdd-writer`
   - `state.next_role=implementer`
   - runtime `recommended_next_command=/kickoff <task-slug>`
   - 同步更新 `handoff.md`
6. 工件更新优先使用 `build-template-meta.js + write-artifact.js`。
7. 输出简洁总结：测试文件、RED 证据、进入实现阶段的下一步。

输出约束:
- 默认中文。
- 不输出冗长背景分析。
