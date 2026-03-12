---
description: 收到需求后固定初始化 spec 阶段。
agent: "OpenCode IMean"
model: openai/gpt-5.2
argument-hint: 描述你的需求、问题或计划
---
你正在运行 oh-imean 的 dispatch 命令（入口阶段）。

任务输入:
$ARGUMENTS

固定流程:
1. 所有需求统一进入固定流程：`spec -> plan -> tdd -> implement -> review -> verify`。
2. dispatch 只做三件事：
   - 确认或创建 `task-slug`
   - 初始化任务工件
   - 把当前任务推进到 `spec` 阶段
3. 默认 `hook_profile=standard`；只有用户明确要求更强护栏时才使用 `strict`。
4. 必须创建或更新：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
5. state/runtime patch 优先使用：
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" dispatch-state <task-slug> --mode standardized --phase spec --status active --current-role "OpenCode IMean" --next-role "OpenCode IMean" --uncertainty <low|medium|high> --goal "<需求摘要>" --recommended-next-command "/plan <task-slug>" --out <state-patch>`
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" dispatch-runtime <task-slug> --phase spec --hook-profile <standard|strict> --recommended-next-command "/plan <task-slug>" --last-blocking-reason "<none|reason>" --out <runtime-patch>`
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" dispatch-handoff <task-slug> --phase spec --from-role "OpenCode IMean" --to-role "OpenCode IMean" --next-action "运行 /plan <task-slug>" --out <meta-file>`
6. 不进入实现，不写测试，不提前产出计划细节。

输出约束:
- 默认中文。
- 只输出当前 `task-slug`、当前阶段 `spec`、不确定性、判定理由和下一步命令。
