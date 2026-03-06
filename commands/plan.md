---
description: 仅做规划并触发用户单选（P1/P2/P3），产出已选方案单页。
agent: oh-imean:spec-planner
model: openai/gpt-5.2
argument-hint: 描述要实现的功能、修复或重构目标
---
你正在运行 oh-imean 的 plan 命令（规划阶段）。

任务输入:
$ARGUMENTS

固定流程:
1. 分两段执行：`spec mode` -> `plan mode`。
2. `spec mode`：
   - 复用或创建 `task-slug`（一任务一目录）。
   - 最小探索后先产出第一版 `requirements.md`，再补最少关键问题。
   - 等用户明确确认需求后才能进入 `plan mode`。
3. `plan mode`：
   - 产出 `P1/P2/P3`，每个都包含：目标前提、文件路径、步骤、风险、验证、需求覆盖。
   - 发起单选，用户确认后只保留并输出被选方案单页。
4. 标准工件必须维护：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/requirements.md`
   - `.oh-imean/specs/<task-slug>/plan.md`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
5. 优先使用 `build-template-meta.js + write-artifact.js` 写入 JSON patch 与 Markdown 模板。
6. 用户选定后，必须推进到实现阶段：
   - `state.phase=implement`
   - `state.next_role=implementer`
   - runtime `recommended_next_command=/kickoff <task-slug>`
7. 采用 `Read -> Judge -> Keep/Drop`，只持久化必要信息，噪音压缩到 `discarded_context_summary`。

交互协议（优先级从高到低）:
1. 优先调用 `question` 工具，参数严格使用:
```json
{
  "questions": [
    {
      "question": "请选择要采用的方案",
      "options": [
        { "label": "P1 - 稳妥最小改动" },
        { "label": "P2 - 平衡方案" },
        { "label": "P3 - 进取方案" }
      ]
    }
  ]
}
```
2. 若 `question` 不可用，尝试 `ask_user_question`。
3. 若仍不可用，尝试 `askuserquestion`。
4. 若都不可用，降级为文本交互，明确要求用户回复 `P1` / `P2` / `P3`。

选后输出规则:
1. 只输出被选方案单页（不重复其他方案）。
2. 必须包含：`task-slug`、`phase`、`uncertainty`、`next-role`、工件路径、执行步骤、验证清单、replan 条件。
3. 默认中文，输出简洁可执行。
