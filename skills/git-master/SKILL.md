---
name: git-master
description: MUST USE for git operations. Split commits cleanly, avoid destructive history edits by default, and use non-interactive git commands.
---
# Git Master

Use this skill for:

- creating commits
- splitting staged or unstaged changes into atomic commits
- rebasing or squashing local history
- searching history with `git log`, `git blame`, `git show`, `git log -S`, `git bisect`

## Core Rules

- Never default to one giant commit.
- Prefer multiple atomic commits when changes touch different concerns.
- Never use destructive commands like `git reset --hard` or `git checkout --` unless explicitly requested.
- Prefer non-interactive git commands.
- Inspect current branch state before acting.

## Commit Workflow

1. Check state first:

```bash
git status
git diff --stat
git diff --staged --stat
git branch --show-current
git log -10 --oneline
```

2. Group changes by concern:

- feature logic
- tests
- refactor
- config
- docs

3. Stage intentionally:

```bash
git add -p
git add <paths>
git restore --staged <paths>
```

4. Write commit messages that match repository style.

## Rebase / Cleanup

- Rebase only when branch history actually needs cleanup.
- If branch is already pushed, warn before rewriting history.
- Prefer:

```bash
git rebase --interactive <base>
git commit --fixup <commit>
git rebase --autosquash <base>
```

## History Search

Use:

```bash
git blame <file>
git log -- <file>
git log -S'<text>'
git show <commit>
git bisect start
```

## Completion

Before finishing any git task, state:

- what changed
- which commits were created or rewritten
- whether history rewrite happened
- whether anything still needs push or review
