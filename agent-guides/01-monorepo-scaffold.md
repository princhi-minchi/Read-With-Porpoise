# Guide 01 — Monorepo Scaffold

## What This Guide Builds

The complete folder structure and package installations for the Read With Porpoise monorepo. After this guide, both the extension and dashboard dev servers will start successfully, and all environment variable placeholders will be in place.

## Prerequisites

- Node.js 18+ installed
- npm 9+ installed
- A terminal open at the repo root (`/Read With Porpoise/`)

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | npm workspaces |
| Extension | Plasmo + React + TypeScript + Tailwind CSS |
| Dashboard | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (slate theme) |

---

## Step 1 — Root workspace package.json

Create this file at the repo root:

**File: `package.json`**
```json
{
  "name": "read-with-porpoise",
  "private": true,
  "workspaces": ["extension", "dashboard"]
}
```

---

## Step 2 — Scaffold the Extension

Run from the repo root:

```bash
npm create plasmo extension -- --with-tailwindcss
```

When prompted:
- Package name: `read-with-porpoise-extension`

Then install Supabase:

```bash
cd extension && npm install @supabase/supabase-js && cd ..
```

---

## Step 3 — Scaffold the Dashboard

Run from the repo root:

```bash
cd dashboard 2>/dev/null || npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

Install shadcn/ui:

```bash
cd dashboard
npx shadcn@latest init --defaults
npx shadcn@latest add button card badge table dialog toast progress
cd ..
```

Install Supabase SSR:

```bash
cd dashboard && npm install @supabase/ssr @supabase/supabase-js && cd ..
```

---

## Step 4 — Create Environment Variable Files

Create these files exactly as shown. Leave values empty — they will be filled in Guide 03.

**File: `dashboard/.env.local`**
```env
BABELSCAPE_API_KEY=
DEEPL_API_KEY=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

CF_ACCOUNT_ID=
CF_API_TOKEN=
CF_KV_NS_VERB_IT=
CF_KV_NS_VERB_ES=
CF_KV_NS_REVERSE_IT=
CF_KV_NS_REVERSE_ES=
```

**File: `extension/.env.development`**
```env
PLASMO_PUBLIC_SUPABASE_URL=
PLASMO_PUBLIC_SUPABASE_ANON_KEY=
PLASMO_PUBLIC_API_BASE_URL=http://localhost:3000
```

**File: `extension/.env.production`**
```env
PLASMO_PUBLIC_SUPABASE_URL=
PLASMO_PUBLIC_SUPABASE_ANON_KEY=
PLASMO_PUBLIC_API_BASE_URL=https://your-deployed-dashboard-url.vercel.app
```

---

## Step 5 — Create the POS Colour Map

This file is used by both the extension components (Sidebar token list) and the content script (in-page span injection). Create it now so it is available to both.

**File: `extension/src/lib/posColors.ts`**
```typescript
export const POS_COLORS: Record<string, { bg: string; text: string }> = {
  NOUN:  { bg: "#BFDBFE", text: "#1E3A5F" },
  VERB:  { bg: "#FED7AA", text: "#7C2D12" },
  AUX:   { bg: "#FDE68A", text: "#78350F" },
  ADJ:   { bg: "#BBF7D0", text: "#14532D" },
  ADV:   { bg: "#99F6E4", text: "#134E4A" },
  DET:   { bg: "#E9D5FF", text: "#4C1D95" },
  PRON:  { bg: "#FBCFE8", text: "#831843" },
  ADP:   { bg: "#E2E8F0", text: "#1E293B" },
  CCONJ: { bg: "#E5E7EB", text: "#1F2937" },
  SCONJ: { bg: "#E5E7EB", text: "#1F2937" },
  PROPN: { bg: "#C7D2FE", text: "#1E1B4B" },
  NUM:   { bg: "#FEF9C3", text: "#713F12" },
  PART:  { bg: "#F1F5F9", text: "#475569" },
  INTJ:  { bg: "#FCE7F3", text: "#831843" },
};
```

Tokens with POS `PUNCT`, `SYM`, or `X` render as plain text — no coloured box.

---

## Step 6 — Verify Folder Structure

After completing steps 1–5, your folder tree should match this exactly:

```
/ (repo root)
├── package.json
├── extension/
│   ├── package.json
│   ├── .env.development
│   ├── .env.production
│   └── src/
│       └── lib/
│           └── posColors.ts
└── dashboard/
    ├── package.json
    ├── .env.local
    └── app/
```

---

## Verification Checklist

Complete all items before starting Guide 02.

- [ ] From repo root, run `cd dashboard && npm run dev`. App starts at `http://localhost:3000` with no errors in terminal. Stop the server (`Ctrl+C`).
- [ ] From repo root, run `cd extension && npm run dev`. Build completes without errors and the folder `extension/.plasmo/build/chrome-mv3-dev/` is created.
- [ ] File `extension/src/lib/posColors.ts` exists and contains 14 POS entries.
- [ ] File `dashboard/.env.local` exists and contains all 10 environment variable keys (values empty is fine).
- [ ] File `extension/.env.development` exists with `PLASMO_PUBLIC_API_BASE_URL=http://localhost:3000`.
