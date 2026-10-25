---
name: "next-task"
description: "Plan and implement the first unchecked task from docs/plan.md when the user asks to run next-task."
---

# next-task

Use this skill when the user asks to run `next-task`.

## Command Template

Take the first unchecked task from docs/plan.md.

1. Identify the task's A–F section in `docs/plan.md`. Read only task-relevant documentation and code; reuse findings already available in the session.
2. Propose a short plan: files to create or change, data flow, edge cases and states (loading, empty, error, partial), tests you will add and the focused checks you will run. Do not write code yet.
3. Wait for my approval. After approval, implement only this task.
4. Follow [AGENTS.md — Verification cadence and development speed](../../../AGENTS.md#verification-cadence-and-development-speed): inspect the diff, lint changed code files and run only new/affected unit or RTL test files. Run typecheck once for TypeScript changes. Documentation-only changes need only diff, link and consistency checks. Fix relevant failures and stop when these checks pass.
5. Do not run full-project checks, build, PostgreSQL integration tests, Playwright/e2e, browser reviews or screenshot matrices after an individual task. Do not create a test environment to finish it. Write necessary integration/e2e tests now, but record their deferred execution or blockers under the task's A–F section. Heavy checks run only after implementing that section's last unfinished task, or when the user directly requests them; use the stage gate in [docs/workflow.md](../../../docs/workflow.md). A commit/push request is not a request to repeat checks.
6. Summarize: what changed, actual check results, anything non-obvious to review, deferred checks and any architectural decision worth recording in docs/decisions.md. Do not claim the stage is verified before its gate passes. Do not commit, push or tick the task until I confirm.
