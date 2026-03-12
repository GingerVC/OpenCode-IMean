---
name: repo-guard
description: Enforces safe coding and verification defaults for local repository work.
---
# Repo Guard

Apply these defaults while working:

- Prefer small, reviewable edits.
- Avoid destructive git commands (`reset --hard`, `checkout --`) unless explicitly requested.
- For scoped feature work, prefer `plan -> kickoff` flow; do not skip selection when the workflow requires a chosen plan.
- For paused standardized tasks, prefer `/resume` or `/status` before re-entering `/plan` or `/kickoff`.
- Keep `state.json`, `handoff.md`, and `runtime/tasks/<task-slug>.json` aligned when a phase changes.
- Run targeted verification for touched code before claiming completion.
- Use `/quality-gate` for fast file-scope checks; use `/verify` for the formal requirement coverage decision.
- When tests or checks are skipped, state that clearly and explain why.
- Before completion, declare verification status explicitly (what was run, what was not run).
- Keep outputs concise and actionable.
