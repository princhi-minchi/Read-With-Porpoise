# Read With Porpoise — Agent Guides

This folder contains self-contained execution guides for building the app. Each guide can be fed to an AI agent independently. **Complete verification at the end of each guide before starting the next.**

---

## What We Are Building

A language learning browser extension + web dashboard. Users highlight text on any webpage, click a "Porpoise" icon, and the selected text is replaced in-place with colour-coded Part-of-Speech boxes. A sidebar slides in showing a DeepL translation and morphological breakdown. Words can be saved to a Supabase-backed Next.js dashboard for spaced repetition (SRS) flashcard review.

**Target languages**: Italian (IT), Spanish (ES) | **Native language**: English (EN) | **Browser**: Chrome only (MV3)

---

## Execution Order

| Guide | What it builds | Depends on | Human steps required |
|---|---|---|---|
| [01-monorepo-scaffold.md](./01-monorepo-scaffold.md) | Folder structure, package installs, env placeholder files | Nothing | None |
| [02-supabase-schema.md](./02-supabase-schema.md) | Postgres tables, RLS, triggers, auth config | Guide 01 complete | Supabase SQL editor + Auth settings |
| [03-nextjs-api-backend.md](./03-nextjs-api-backend.md) | Supabase client, CF KV lookup, all API routes | Guides 01 + 02 complete; env vars filled in | Fill in `.env.local` with real API keys and CF namespace IDs |
| [04-extension.md](./04-extension.md) | Chrome extension: content script, sidebar, auth | Guide 03 running on localhost:3000 | Load unpacked in `chrome://extensions` |
| [05-dashboard-pages.md](./05-dashboard-pages.md) | All Next.js UI pages: login, dashboard, words, review | Guides 01–03 complete | None |

---

## Rules for Agents

- Do not skip verification. Each guide ends with a checklist — every item must pass before proceeding.
- Do not reference the master guide or other sub-guides. Each guide is fully standalone.
- Do not invent solutions not specified in the guide. If something is unclear, stop and ask a human.
- Guides 01–03 can be executed without a browser. Guide 04 requires Chrome.

---

## Files in This Folder

```
agent-guides/
├── README.md                    ← this file (index + order)
├── MASTER_EXECUTION_GUIDE.md    ← full combined reference (do not feed to agents directly)
├── 01-monorepo-scaffold.md
├── 02-supabase-schema.md
├── 03-nextjs-api-backend.md
├── 04-extension.md
└── 05-dashboard-pages.md
```
