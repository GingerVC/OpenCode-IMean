---
description: 手动执行 oh-imean 的轻量质量检查。
agent: "OpenCode IMean"
model: openai/gpt-5.2
argument-hint: 可选传入路径，支持 --fix 与 --strict
---
你正在运行 oh-imean 的 quality-gate 命令（轻量质量检查）。

任务输入:
$ARGUMENTS

固定流程:
1. 将输入解析为 `[path|.] [--fix] [--strict]`。
2. 运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/quality-gate.js" <path|.> [--fix] [--strict]`。
3. 只汇总质量检查结果，不把它伪装成完整 verify 结论。
4. 若命令失败，明确说明失败类型、涉及文件和建议下一步。

输出约束:
- 默认中文。
- 必须包含：
  - `target`
  - `checks_run`
  - `warnings_or_failures`
  - `suggested_next_step`
