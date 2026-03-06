---
description: 对已实现改动做独立审查，重点关注需求一致性、回归风险和测试缺口。
agent: oh-imean:reviewer
model: openai/gpt-5.2
argument-hint: 可传 task-slug、变更范围或 review 目标
---
你正在运行 oh-imean 的 review 命令（独立审查阶段）。

任务输入:
$ARGUMENTS

固定流程:
1. `review` 是两种模式都必须经过的强制阶段，不是可选增强。
2. 若识别到 `task-slug`，优先读取：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/specs/<task-slug>/review.md`（若已存在则更新）
   - standardized 下再读取：
     - `.oh-imean/specs/<task-slug>/requirements.md`
     - `.oh-imean/specs/<task-slug>/plan.md`
3. 若 `phase!=review`，输出结构化阻塞，不假装继续。
4. 审查时重点判断：
   - 实现是否满足已确认需求或用户明确意图
   - 是否引入回归风险
   - 是否遗漏关键测试
5. 不改代码，不伪装成最终验证结论，不替代 `/verify`。
6. 审查结果必须写入 `.oh-imean/specs/<task-slug>/review.md`。
7. 若 review 通过：
   - 更新 `state.json` 为 `phase=verify`、`current_role=reviewer`、`next_role=verifier`
   - 更新 `runtime/tasks/<task-slug>.json`，`recommended_next_command=/verify <task-slug>`
8. 若 review 阻断：
   - 更新 `state.json` 为 `phase=implement`、`current_role=reviewer`、`next_role=implementer`
   - 更新 `runtime/tasks/<task-slug>.json`，`recommended_next_command=/kickoff <task-slug>`
9. 优先使用：
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" review-report <task-slug> ... --out <review-meta>`
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" review-state <task-slug> ... --out <state-patch>`
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-template-meta.js" review-runtime <task-slug> ... --out <runtime-patch>`
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" review <task-slug> --template --meta-file <review-meta>`
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" state <task-slug> --merge-file <state-patch>`
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/write-artifact.js" runtime <task-slug> --merge-file <runtime-patch>`

输出约束:
- 默认中文。
- Findings first。
- 必须包含：
  - `task-slug`
  - `phase`
  - `scope`
  - `findings`
  - `testing_gaps`
  - `recommended_next_step`
