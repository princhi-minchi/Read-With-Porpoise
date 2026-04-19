# Memory Bank Update Protocol

After completing any task, update the relevant `.claudedoc/` file(s) before closing the conversation. This keeps future sessions from having to re-derive context.

## What to update and when

| Trigger | File to update |
|---|---|
| Finish implementing a feature | `active-task.md` — mark done, add next task |
| Discover the API returns a different shape | `data-shapes.md` — correct the shape |
| Add a new component, route, or lib file | `architecture.md` — add to the file tree |
| Find a new pattern or convention | `conventions.md` — add it |
| Start working on something new | `active-task.md` — replace current task |

## What NOT to put here

- Code itself (read the actual files)
- Git history (use `git log`)
- Temporary debugging notes
- Anything already in `agent-guides/` that hasn't changed

## How to update

Use the Edit tool on the relevant file. Don't rewrite the whole file — surgically edit the outdated section. Keep entries concise.

## Reminder prompt

At the end of each task, Claude should say: "Memory bank updated — [file(s) changed] reflect [what changed]."
