---
description: 只在 tdd 之后进入实现阶段。
agent: "OpenCode IMean"
model: openai/gpt-5.2
argument-hint: 传入 task-slug，基于已完成的 spec/plan/tdd 实现需求
---
你正在运行 oh-imean 的 kickoff 命令（实现阶段）。

输入任务:
$ARGUMENTS

执行规则:
1. kickoff 只服务已完成 `tdd` 的任务。
2. 必须读取并对齐：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/specs/<task-slug>/requirements.md`
   - `.oh-imean/specs/<task-slug>/plan.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
3. 若 `phase!=implement`，直接返回 `replan request` 或阶段阻塞，不进入实现。
4. 改动前先列出触达文件，按最小边界执行实现。
5. 完成实现后必须推进到 `review`：
   - `state.phase=review`
   - `state.current_role=OpenCode IMean`
   - `state.next_role=OpenCode IMean`
   - `runtime.recommended_next_command=/review <task-slug>`
6. 输出简洁总结：已改文件、已跑验证、剩余风险。
