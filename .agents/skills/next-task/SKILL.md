---
name: "next-task"
description: "Plan and implement the first unchecked task from docs/plan.md when the user asks to run next-task."
---

# next-task

Use this skill when the user asks to run `next-task`.

## Command Template

Take the first unchecked task from docs/plan.md.

1. Re-read the parts of docs, that this task touches.
2. Propose a short plan: files to create or change, data flow, edge cases and states (loading, empty, error, partial), tests you will add. Do not write code yet.
3. Wait for my approval. After approval, implement only this task.
4. Run and fix failures.
5. Summarize: what changed, anything non-obvious I should review, and any decision worth adding to docs/decisions.md. Do not commit and do not tick the task until I confirm.
