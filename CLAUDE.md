# Read With Porpoise — Claude Context

Read `.claudedoc/` before doing any work. These files are the memory bank.

| File | Contents |
|---|---|
| [.claudedoc/architecture.md](.claudedoc/architecture.md) | Monorepo structure, tech stack, key architectural decisions, Supabase schema |
| [.claudedoc/conventions.md](.claudedoc/conventions.md) | Styling rules (inline styles in extension, Tailwind in dashboard), naming, auth patterns |
| [.claudedoc/data-shapes.md](.claudedoc/data-shapes.md) | Conjugation JSON shape, NLP token type, saved_words schema, POS color map |
| [.claudedoc/active-task.md](.claudedoc/active-task.md) | What is currently being worked on and what has been completed |
| [.claudedoc/update-protocol.md](.claudedoc/update-protocol.md) | How to keep this memory bank current after each task |

## Critical rules

1. **Extension components use inline styles only.** No Tailwind. Shadow DOM context.
2. **Dashboard uses Tailwind + shadcn/ui.** Server components by default.
3. **Never read auth from the content script directly.** Always send a message to the background service worker.
4. **The conjugation data lives in Cloudflare KV, not Supabase.** Queried via the dashboard `/api/conjugate` route.
5. **Save the selection Range synchronously** inside `mouseup` before any async calls or state updates.

## Running the project

```bash
# Terminal 1
cd dashboard && npm run dev      # http://localhost:3000

# Terminal 2
cd extension && npm run dev      # builds to extension/.plasmo/build/chrome-mv3-dev
```
