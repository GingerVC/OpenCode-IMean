---
description: 单角色对标准化任务或局部改动执行最终验证，并落盘验证工件。
agent: "OpenCode IMean"
model: openai/gpt-5.2
argument-hint: 可传 task-slug；留空则验证最近活跃 standardized 任务
---
你正在运行 oh-imean 的 verify 命令（最终验证阶段）。

任务输入:
$ARGUMENTS

固定流程:
1. 若识别到 `task-slug`，优先验证该 standardized 任务；否则回退到最近活跃 standardized 任务。
2. 标准化任务下，必须先读取：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/specs/<task-slug>/requirements.md`
   - `.oh-imean/specs/<task-slug>/plan.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
3. 若 `phase!=verify`，输出结构化阻塞，不假装继续。
4. 运行相关测试、lint、typecheck、build 或最小 smoke checks。
5. 形成 `pass / fail / pass_with_risk` 结论。
6. 对 standardized 任务，优先使用 artifact writer 更新：
   - `state.json`
   - `runtime/tasks/<task-slug>.json`
   - `verification.md`
7. artifact writer 用法：
   - state/runtime patch 优先先生成 `patch-file`：
    - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" verify-state <task-slug> --phase done --status <active|blocked|done> --current-role OpenCode IMean --next-role <OpenCode IMean|none> --verification-status <pass|fail|pass_with_risk> --last-blocking-reason "<reason>" --recommended-next-command "<command>" --last-verified-at "<iso-time>" --discarded-context-summary "<summary>" --out <state-patch>`
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" verify-runtime <task-slug> --phase verify --verification-status <pass|fail|pass_with_risk> --selected-option "<P1|P2|P3>" --active-step "<step>" --last-blocking-reason "<reason>" --recommended-next-command "<command>" --out <runtime-patch>`
   - JSON 工件：
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" state <task-slug> --merge-file <state-patch>`
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" runtime <task-slug> --merge-file <runtime-patch>`
   - 优先先生成 `meta-file`：
     - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" verify-report <task-slug> --status <pass|fail|pass_with_risk> ... --out <verification-meta>`
   - 模板初始化：`node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" verification <task-slug> --template --meta-file <verification-meta>`
   - Markdown 覆盖写入：`node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" verification <task-slug> --stdin`
8. 写入 `verification.md` 时，至少包含：
   - `# Verification Report`
   - `## Status`
   - `## Summary`
   - `## Checks Run`
   - `## Checks Not Run`
   - `## Requirement Coverage`
   - `## Risks / Remaining Issues`
  - `## Recommended Next Step`
  - `## Walkthrough`
9. 若结果为 `fail` 且原因属于实现问题，推荐下一步必须回 `/kickoff <task-slug>`；若属于需求/计划冲突，推荐下一步必须回 `/plan <task-slug>`；若要开启新任务再回 `/dispatch <需求>`。

输出约束:
- 默认中文。
- 必须包含：
  - `task-slug`
  - `status`
  - `verification_items`
  - `requirement_coverage`
  - `evidence`
  - `risks`
  - `recommended_next_step`
