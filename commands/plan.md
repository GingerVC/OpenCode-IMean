---
description: 做自适应规划；低风险任务给单一推荐方案，高风险任务再走多方案选择。
agent: oh-imean:spec-planner
model: openai/gpt-5.2
argument-hint: 描述要实现的功能、修复或重构目标
---
你正在运行 oh-imean 的 plan 命令（规划阶段）。

任务输入:
$ARGUMENTS

固定流程:
1. 分两段执行：`spec mode` -> `plan mode`，但规划深度允许自适应。
2. `spec mode`：
   - 复用或创建 `task-slug`（一任务一目录）。
   - 最小探索后先产出第一版 `requirements.md`，再补最少关键问题。
   - 若 `uncertainty=low` 且假设可控，可带着显式 assumptions 进入 `plan mode`，不强制等待完整确认。
3. `plan mode`：
   - `planning_depth=full`：产出 `P1/P2/P3`，每个都包含：目标前提、文件路径、步骤、风险、验证、需求覆盖，并发起单选。
   - `planning_depth=lite`：可以只产出一个推荐方案，但必须明确 assumptions、边界、风险、验证。
4. 标准工件必须维护：
   - `.oh-imean/specs/<task-slug>/state.json`
   - `.oh-imean/specs/<task-slug>/requirements.md`
   - `.oh-imean/specs/<task-slug>/plan.md`
   - `.oh-imean/specs/<task-slug>/handoff.md`
   - `.oh-imean/runtime/tasks/<task-slug>.json`
5. 优先使用 `build-template-meta.js + write-artifact.js` 写入 JSON patch 与 Markdown 模板。
6. 计划完成后必须根据 `execution_lane` 推进：
   - `execution_lane=direct`：
     - `state.phase=implement`
     - `state.next_role=implementer`
     - runtime `recommended_next_command=/kickoff <task-slug>`
   - `execution_lane=tdd`：
     - `state.phase=tdd`
     - `state.next_role=tdd-writer`
     - runtime `recommended_next_command=/tdd <task-slug>`
   - 无论哪条车道，都必须把 `planning_depth` 与 `execution_lane` 写入 state/runtime。
7. 采用 `Read -> Judge -> Keep/Drop`，只持久化必要信息，噪音压缩到 `discarded_context_summary`。

交互协议（优先级从高到低）:
1. 只有在 `planning_depth=full` 且确实存在真实取舍时，优先调用 `question` 工具，参数严格使用:
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

输出规则:
1. `planning_depth=full` 时，只输出被选方案单页（不重复其他方案）。
2. `planning_depth=lite` 时，只输出单一推荐方案页，不额外制造伪选择。
3. 必须包含：`task-slug`、`phase`、`uncertainty`、`planning-depth`、`execution-lane`、`next-role`、工件路径、执行步骤、验证清单、replan 条件。
4. 默认中文，输出简洁可执行。
