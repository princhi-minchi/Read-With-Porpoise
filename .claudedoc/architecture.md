# Architecture

## What This Is

A language learning tool for English speakers learning Italian (IT) and Spanish (ES).

- **Extension**: User highlights text on any webpage → clicks the 🐬 button → selected text is replaced in-place with color-coded POS boxes (direct DOM injection). A Shadow DOM sidebar slides in showing the full morphological breakdown and DeepL translation. Clicking a box on the page selects that token in the sidebar. Closing restores original text.
- **Dashboard**: Supabase-backed Next.js app where users manage saved words and do spaced repetition (SRS) flashcard reviews.

## Monorepo Structure

```
/ (repo root)
├── package.json              ← npm workspaces root: ["extension", "dashboard"]
├── .claudedoc/               ← memory bank (this directory)
├── agent-guides/             ← original build specs (01–05 + MASTER_EXECUTION_GUIDE.md)
├── extension/                ← Plasmo Chrome extension (Manifest V3, Chrome only)
│   └── src/
│       ├── contents/main.tsx         ← content script: selection listener, DOM annotation, sidebar injector
│       ├── components/Sidebar.tsx    ← Shadow DOM sidebar (React)
│       ├── components/POSBox.tsx     ← colored token box component
│       ├── components/LoadingPopup.tsx
│       ├── background/index.ts       ← service worker: Supabase auth, chrome.storage
│       └── lib/posColors.ts          ← POS → {bg, text} color map
└── dashboard/                ← Next.js 14 App Router
    ├── app/
    │   ├── (auth)/login/page.tsx
    │   ├── dashboard/page.tsx        ← stats overview ("The Reef")
    │   ├── dashboard/words/page.tsx  ← saved words management
    │   ├── dashboard/review/page.tsx ← SRS flashcard review
    │   └── api/
    │       ├── nlp/route.ts          ← proxies Babelscape, caches to lemma_cache
    │       ├── translate/route.ts    ← proxies DeepL → English
    │       ├── conjugate/route.ts    ← reads from Cloudflare KV
    │       └── words/route.ts        ← GET/POST/DELETE/PATCH saved_words
    └── lib/
        ├── supabase/client.ts        ← browser client (@supabase/ssr)
        ├── supabase/server.ts        ← server client (SSR cookies)
        └── cloudflare/kv.ts          ← CF KV REST API helpers (reverse lookup + verb data)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Extension Framework | Plasmo + React + TypeScript |
| Extension Styling | **Inline styles only** (Tailwind not used in extension components) |
| Dashboard Framework | Next.js 14 (App Router) |
| Dashboard Styling | Tailwind CSS + shadcn/ui (slate base, CSS variables) |
| Backend / Auth | Supabase (Postgres + Auth + RLS) |
| NLP | Babelscape API |
| Translation | DeepL API (free tier: `api-free.deepl.com`) |
| Conjugation Data | Cloudflare KV (existing asset, queried via REST API) |

## Key Architecture Decisions

- **Two rendering layers in the extension**: Shadow DOM (React, Plasmo-managed) for UI overlays; plain DOM manipulation for in-page colored token spans. These never mix.
- **Range must be saved synchronously**: `window.getSelection()` is cleared on button click. `range.cloneRange()` is captured inside `mouseup` before any async work.
- **Auth flows through the background service worker**: Content script sends `GET_SESSION` / `SIGN_IN_GOOGLE` messages to `background/index.ts`, which owns the Supabase client stored in `chrome.storage.local`.
- **Conjugation data lives in Cloudflare KV**: Not Supabase. The dashboard API route (`/api/conjugate`) queries it via REST. The extension calls the dashboard API — it never touches CF directly.
- **NLP results are cached** in the `lemma_cache` Supabase table (fire-and-forget upsert keyed on `lemma + language`).

## Supabase Tables

| Table | Purpose |
|---|---|
| `user_stats` | XP, level, streak, total_words_saved — one row per user |
| `saved_words` | Every word saved by a user, with SRS fields (next_review_at, ease_factor, etc.) |
| `lemma_cache` | Cached Babelscape NLP results keyed on (lemma, language) |

RLS is enabled on `user_stats` and `saved_words`. `lemma_cache` has no RLS (read-only cache).

## Environment Variables

**`dashboard/.env.local`**: `BABELSCAPE_API_KEY`, `DEEPL_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_KV_NS_VERB_IT`, `CF_KV_NS_VERB_ES`, `CF_KV_NS_REVERSE_IT`, `CF_KV_NS_REVERSE_ES`

**`extension/.env.development`**: `PLASMO_PUBLIC_SUPABASE_URL`, `PLASMO_PUBLIC_SUPABASE_ANON_KEY`, `PLASMO_PUBLIC_API_BASE_URL=http://localhost:3000`
