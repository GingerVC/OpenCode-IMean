---
description: 固定在实现前先写失败测试并确认 RED。
agent: "OpenCode IMean"
model: openai/gpt-5.2
argument-hint: 传入 task-slug，基于已确认 spec/plan 执行 TDD RED 阶段
---
你正在运行 oh-imean 的 tdd 命令（测试先行阶段）。

输入任务:
$ARGUMENTS

执行规则:
1. 进入 tdd 前，必须已经完成 `spec` 和 `plan`。
2. 必须先读取：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/specs/<task-slug>/requirements.md`
   - `.oh-imean/specs/<task-slug>/plan.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
3. 只有在 `phase=tdd` 时才允许继续；若阶段不匹配或关键工件缺失，直接结构化阻塞。
4. 只允许编写或更新测试与必要测试夹具；禁止实现生产代码。
5. 必须运行最小必要测试并确认结果是预期 RED：
   - 失败原因必须与能力尚未实现一致
   - 若测试已通过，必须停下并说明计划或测试设计失真
6. RED 确认后，推进到实现阶段：
   - `state.phase=implement`
   - `state.current_role=OpenCode IMean`
   - `state.next_role=OpenCode IMean`
   - `runtime.recommended_next_command=/kickoff <task-slug>`
7. 输出简洁总结：测试文件、RED 证据、下一步实现入口。
