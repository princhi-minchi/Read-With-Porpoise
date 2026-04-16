# Read With Porpoise — Execution Guide

This document is the single source of truth for building the app. Every decision has been made. Do not ask clarifying questions — implement exactly as specified.

---

## 1. What We Are Building

A language learning browser extension + web dashboard.

- **Extension**: User highlights text on any webpage → clicks a "Porpoise" icon → the selected text on the page is replaced in-place with color-coded POS boxes (direct DOM injection), and a Shadow DOM sidebar slides in showing the full morphological breakdown and DeepL translation. Clicking a box on the page selects that token in the sidebar. Words can be saved to the dashboard. Closing the sidebar restores the original page text.
- **Dashboard**: Supabase-backed Next.js app where users manage saved words and do spaced repetition (SRS) flashcard reviews.

**Target languages**: Italian (IT), Spanish (ES)  
**User's native language**: English (EN) — all translations go TO English  
**Browser target**: Chrome only (Manifest V3)

---

## 2. Tech Stack

| Layer | Technology |
| :--- | :--- |
| Extension Framework | Plasmo + React + TypeScript |
| Extension Styling | Tailwind CSS (via Plasmo's built-in support) |
| Dashboard Framework | Next.js 14 (App Router) |
| Dashboard Styling | Tailwind CSS + shadcn/ui |
| Backend / Auth | Supabase (Postgres + Auth) |
| NLP | Babelscape API |
| Translation | DeepL API (Free tier endpoint) |
| Conjugation Data | Cloudflare KV (existing asset, queried via REST API) |

---

## 3. Repository Structure

This is a monorepo with npm workspaces. Run all scaffold commands from the repo root (`/`).

```
/ (repo root)
├── package.json              ← workspace root
├── extension/                ← Plasmo Chrome extension
│   ├── package.json
│   ├── .env.development
│   └── src/
│       ├── contents/
│       │   └── main.tsx      ← content script (selection listener, in-page annotation, sidebar injector)
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── POSBox.tsx
│       │   └── LoadingPopup.tsx
│       └── background/
│           └── index.ts      ← service worker (auth token management)
└── dashboard/                ← Next.js App Router
    ├── package.json
    ├── .env.local
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx          ← redirect to /dashboard
    │   ├── (auth)/
    │   │   └── login/
    │   │       └── page.tsx
    │   ├── dashboard/
    │   │   ├── page.tsx      ← stats overview
    │   │   ├── words/
    │   │   │   └── page.tsx  ← saved words management
    │   │   └── review/
    │   │       └── page.tsx  ← SRS flashcard review
    │   └── api/
    │       ├── nlp/
    │       │   └── route.ts
    │       ├── translate/
    │       │   └── route.ts
    │       ├── conjugate/
    │       │   └── route.ts
    │       └── words/
    │           └── route.ts
    └── lib/
        ├── supabase/
        │   ├── client.ts     ← browser Supabase client
        │   └── server.ts     ← server Supabase client (SSR cookies)
        └── cloudflare/
            └── kv.ts         ← CF KV REST API helpers
```

### Scaffold Commands

```bash
# Repo root package.json
cat > package.json << 'EOF'
{
  "name": "read-with-porpoise",
  "private": true,
  "workspaces": ["extension", "dashboard"]
}
EOF

# Create extension with Plasmo
cd extension && npm init plasmo -- --with-tailwindcss
# When prompted for name: read-with-porpoise-extension

# Create dashboard with Next.js
cd ../dashboard
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"

# Install shadcn/ui in dashboard
npx shadcn@latest init
# Accept defaults: style=default, base color=slate, CSS variables=yes

# Add shadcn components used throughout the app
npx shadcn@latest add button card badge table dialog toast progress
```

---

## 4. Environment Variables

### `dashboard/.env.local`

```env
BABELSCAPE_API_KEY=your_babelscape_key_here
DEEPL_API_KEY=your_deepl_key_here

NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

CF_ACCOUNT_ID=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token_with_kv_read_permissions

# Cloudflare KV Namespace IDs (find these in the Cloudflare dashboard under Workers → KV)
CF_KV_NS_VERB_IT=namespace_id_for_VERB_DB
CF_KV_NS_VERB_ES=namespace_id_for_SPANISH_VERB_DB
CF_KV_NS_REVERSE_IT=namespace_id_for_REVERSE_DB_V2
CF_KV_NS_REVERSE_ES=namespace_id_for_SPANISH_REVERSE_DB
```

### `extension/.env.development`

```env
PLASMO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
PLASMO_PUBLIC_API_BASE_URL=http://localhost:3000
```

### `extension/.env.production`

```env
PLASMO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
PLASMO_PUBLIC_API_BASE_URL=https://your-deployed-dashboard-url.vercel.app
```

---

## 5. Supabase Schema

Run these SQL statements in the Supabase SQL editor (Dashboard → SQL Editor) in this exact order.

### Enable Extensions

```sql
create extension if not exists "uuid-ossp";
```

### Table: `user_stats`

```sql
create table public.user_stats (
  id uuid references auth.users(id) on delete cascade primary key,
  xp integer not null default 0,
  level integer not null default 1,
  streak_count integer not null default 0,
  last_active_date date,
  total_words_saved integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_stats enable row level security;

create policy "Users can read own stats"
  on public.user_stats for select
  using (auth.uid() = id);

create policy "Users can update own stats"
  on public.user_stats for update
  using (auth.uid() = id);

create policy "Users can insert own stats"
  on public.user_stats for insert
  with check (auth.uid() = id);
```

### Table: `saved_words`

```sql
create table public.saved_words (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  lemma text not null,
  raw_text text not null,
  language text not null check (language in ('IT', 'ES')),
  pos text not null,
  context_sentence text,
  translation_en text,
  morph_data jsonb,
  next_review_at timestamptz not null default now(),
  review_interval_days float not null default 1,
  ease_factor float not null default 2.5,
  xp_value integer not null default 10,
  created_at timestamptz not null default now()
);

alter table public.saved_words enable row level security;

create policy "Users can read own words"
  on public.saved_words for select
  using (auth.uid() = user_id);

create policy "Users can insert own words"
  on public.saved_words for insert
  with check (auth.uid() = user_id);

create policy "Users can update own words"
  on public.saved_words for update
  using (auth.uid() = user_id);

create policy "Users can delete own words"
  on public.saved_words for delete
  using (auth.uid() = user_id);

create index saved_words_user_id_idx on public.saved_words(user_id);
create index saved_words_next_review_idx on public.saved_words(user_id, next_review_at);
```

### Table: `lemma_cache`

```sql
create table public.lemma_cache (
  id uuid default uuid_generate_v4() primary key,
  lemma text not null,
  language text not null check (language in ('IT', 'ES')),
  pos text,
  morph_data jsonb,
  created_at timestamptz not null default now(),
  unique(lemma, language)
);
```

### Trigger: auto-create `user_stats` row on signup

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_stats (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Supabase Auth Configuration

In the Supabase dashboard → Authentication → Providers:
1. Enable **Google** provider. Add your Google OAuth Client ID and Secret.
2. Add your extension's OAuth redirect URL: `https://your-project-ref.supabase.co/auth/v1/callback`

---

## 6. Dashboard: Supabase Client Setup

### `dashboard/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `dashboard/lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

Install the SSR package:

```bash
cd dashboard && npm install @supabase/ssr @supabase/supabase-js
```

---

## 7. Dashboard: Cloudflare KV Lookup

### `dashboard/lib/cloudflare/kv.ts`

This file implements the verb conjugation lookup by querying the Cloudflare KV REST API directly.

```typescript
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CF_API_TOKEN!;

async function kvGet(namespaceId: string, key: string): Promise<string | null> {
  const encodedKey = encodeURIComponent(key);
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${namespaceId}/values/${encodedKey}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.text();
}

function normalize(word: string): string {
  return word.toLowerCase().normalize("NFC");
}

function accentless(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");
}

function getPrefix(word: string): string {
  return word.slice(0, 2);
}

async function reverseItLookup(wordForm: string): Promise<string[]> {
  const nsId = process.env.CF_KV_NS_REVERSE_IT!;
  const strategies = [
    { prefix: "it:rev:v2:surface:", form: wordForm },
    { prefix: "it:rev:v2:norm:", form: normalize(wordForm) },
    { prefix: "it:rev:v2:accentless:", form: accentless(wordForm) },
  ];
  for (const { prefix, form } of strategies) {
    const shardKey = `${prefix}${getPrefix(form)}`;
    const raw = await kvGet(nsId, shardKey);
    if (!raw) continue;
    const shard = JSON.parse(raw) as Record<string, string[]>;
    if (shard[form]) return shard[form];
  }
  return [];
}

async function reverseEsLookup(wordForm: string): Promise<string[]> {
  const nsId = process.env.CF_KV_NS_REVERSE_ES!;
  const form = normalize(wordForm);
  const shardKey = `es:rev:norm:${getPrefix(form)}`;
  const raw = await kvGet(nsId, shardKey);
  if (!raw) return [];
  const shard = JSON.parse(raw) as Record<string, string[]>;
  return shard[form] ?? [];
}

async function getVerbData(
  infinitive: string,
  language: "IT" | "ES"
): Promise<Record<string, unknown> | null> {
  const nsId =
    language === "IT"
      ? process.env.CF_KV_NS_VERB_IT!
      : process.env.CF_KV_NS_VERB_ES!;
  const raw = await kvGet(nsId, `verb:${infinitive}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function lookupConjugation(
  wordForm: string,
  language: "IT" | "ES"
): Promise<{
  infinitive: string;
  conjugationTable: Record<string, unknown>;
} | null> {
  const candidates =
    language === "IT"
      ? await reverseItLookup(wordForm)
      : await reverseEsLookup(wordForm);

  if (candidates.length === 0) return null;

  const infinitive = candidates[0];
  const conjugationTable = await getVerbData(infinitive, language);
  if (!conjugationTable) return null;

  return { infinitive, conjugationTable };
}
```

---

## 8. Dashboard: API Routes

### `dashboard/app/api/nlp/route.ts`

Proxies text to Babelscape. Caches results in `lemma_cache` by lemma + language.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { text, language } = await req.json();
  if (!text || !language) {
    return NextResponse.json({ error: "text and language required" }, { status: 400 });
  }

  const url = new URL("https://api.babelscape.com/v1/nlp-pipeline/query");
  url.searchParams.set("key", process.env.BABELSCAPE_API_KEY!);
  url.searchParams.set("text", text);
  url.searchParams.set("language", language);

  const babelRes = await fetch(url.toString(), { method: "POST" });
  if (!babelRes.ok) {
    return NextResponse.json({ error: "Babelscape error" }, { status: 502 });
  }

  const data = await babelRes.json();

  // Cache individual lemmas (fire-and-forget)
  const supabase = await createClient();
  for (const sentence of data.sentences ?? []) {
    for (const token of sentence.tokens ?? []) {
      if (!token.morph?.lemma) continue;
      supabase.from("lemma_cache").upsert(
        {
          lemma: token.morph.lemma,
          language,
          pos: token.pos,
          morph_data: token.morph,
        },
        { onConflict: "lemma,language", ignoreDuplicates: true }
      );
    }
  }

  return NextResponse.json(data);
}
```

### `dashboard/app/api/translate/route.ts`

Proxies text to DeepL, translating to English.

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, sourceLang } = await req.json();
  if (!text || !sourceLang) {
    return NextResponse.json({ error: "text and sourceLang required" }, { status: 400 });
  }

  const body = new URLSearchParams({
    text,
    source_lang: sourceLang,
    target_lang: "EN",
  });

  const deeplRes = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY!}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!deeplRes.ok) {
    return NextResponse.json({ error: "DeepL error" }, { status: 502 });
  }

  const data = await deeplRes.json();
  const translation = data.translations?.[0]?.text ?? "";
  return NextResponse.json({ translation });
}
```

### `dashboard/app/api/conjugate/route.ts`

Looks up conjugation data from Cloudflare KV.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { lookupConjugation } from "@/lib/cloudflare/kv";

export async function POST(req: NextRequest) {
  const { wordForm, language } = await req.json();
  if (!wordForm || !language) {
    return NextResponse.json({ error: "wordForm and language required" }, { status: 400 });
  }

  const result = await lookupConjugation(wordForm, language as "IT" | "ES");
  if (!result) {
    return NextResponse.json({ error: "Conjugation not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
```

### `dashboard/app/api/words/route.ts`

Saves and retrieves words for the authenticated user.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lemma, rawText, language, pos, contextSentence, translationEn, morphData } =
    await req.json();

  const { data: word, error } = await supabase
    .from("saved_words")
    .insert({
      user_id: user.id,
      lemma,
      raw_text: rawText,
      language,
      pos,
      context_sentence: contextSentence,
      translation_en: translationEn,
      morph_data: morphData,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update user stats
  await supabase.rpc("increment_user_stats", { user_id_param: user.id });

  return NextResponse.json({ word });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language");
  const pos = searchParams.get("pos");
  const dueForReview = searchParams.get("due_for_review") === "true";

  let query = supabase
    .from("saved_words")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (language) query = query.eq("language", language);
  if (pos) query = query.eq("pos", pos);
  if (dueForReview) query = query.lte("next_review_at", new Date().toISOString());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ words: data });
}
```

Add this SQL function to Supabase for atomic stats update:

```sql
create or replace function public.increment_user_stats(user_id_param uuid)
returns void language plpgsql security definer as $$
begin
  update public.user_stats
  set
    total_words_saved = total_words_saved + 1,
    xp = xp + 10,
    level = greatest(1, floor((xp + 10) / 100) + 1)::integer,
    last_active_date = current_date,
    streak_count = case
      when last_active_date = current_date - 1 then streak_count + 1
      when last_active_date = current_date then streak_count
      else 1
    end,
    updated_at = now()
  where id = user_id_param;
end;
$$;
```

---

## 9. Plasmo Extension

### Setup

```bash
cd extension
npm install @supabase/supabase-js
```

In `package.json` for the extension, ensure Plasmo's `manifest` key includes host permissions:

```json
{
  "manifest": {
    "host_permissions": ["<all_urls>"],
    "permissions": ["storage", "identity"]
  }
}
```

### POS Color Map

Create `extension/src/lib/posColors.ts`:

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

Tokens with POS `PUNCT`, `SYM`, or `X` render as plain text (no colored box).

### Background Service Worker: `extension/src/background/index.ts`

Manages Supabase session in `chrome.storage.local` and responds to auth queries from the content script.

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: {
        getItem: (key) =>
          new Promise((resolve) =>
            chrome.storage.local.get([key], (result) => resolve(result[key] ?? null))
          ),
        setItem: (key, value) =>
          new Promise((resolve) =>
            chrome.storage.local.set({ [key]: value }, resolve)
          ),
        removeItem: (key) =>
          new Promise((resolve) =>
            chrome.storage.local.remove([key], resolve)
          ),
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_SESSION") {
    supabase.auth.getSession().then(({ data }) => sendResponse({ session: data.session }));
    return true;
  }
  if (message.type === "SIGN_IN_GOOGLE") {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.PLASMO_PUBLIC_SUPABASE_URL}/auth/v1/callback` },
    }).then(({ data }) => {
      if (data.url) chrome.tabs.create({ url: data.url });
    });
    return true;
  }
  if (message.type === "SIGN_OUT") {
    supabase.auth.signOut().then(() => sendResponse({ ok: true }));
    return true;
  }
});
```

### Content Script: `extension/src/contents/main.tsx`

This is the core of the extension. It runs on every page.

**Architecture — two separate layers:**
- **Shadow DOM** (React-managed): hosts the Porpoise button, LoadingPopup, and Sidebar UI overlays. These never touch the host page's DOM.
- **Page DOM** (direct manipulation): the colored token `<span>` elements injected directly into the host page's text. This is NOT React — it is plain DOM manipulation.

**Critical requirement: save the `Range` before any async work.** `window.getSelection()` is cleared the moment the user clicks the Porpoise button. You must capture `range.cloneRange()` and the selected text string synchronously inside `mouseup`, before any state updates or fetches.

```typescript
import type { PlasmoCSConfig } from "plasmo";
import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "~components/Sidebar";
import LoadingPopup from "~components/LoadingPopup";
import { POS_COLORS } from "~lib/posColors";

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
};

const API_BASE = process.env.PLASMO_PUBLIC_API_BASE_URL!;
const NO_BOX_POS = new Set(["PUNCT", "SYM", "X"]);

// --- In-page DOM annotation (not React) ---

type Token = {
  index: number;
  rawText: string;
  pos: string;
  absoluteOffset: { start: number; end: number };
  morph?: { lemma?: string; inflectionCategories?: string[] };
};

function buildAnnotationContainer(
  tokens: Token[],
  originalText: string,
  onTokenClick: (token: Token) => void
): HTMLSpanElement {
  const container = document.createElement("span");
  container.setAttribute("data-porpoise", "annotated");

  let cursor = 0;
  for (const token of tokens) {
    // Insert any inter-token text (spaces, punctuation between tokens)
    if (token.absoluteOffset.start > cursor) {
      const gap = originalText.slice(cursor, token.absoluteOffset.start);
      container.appendChild(document.createTextNode(gap));
    }

    if (NO_BOX_POS.has(token.pos)) {
      container.appendChild(document.createTextNode(token.rawText));
    } else {
      const colors = POS_COLORS[token.pos] ?? { bg: "#F1F5F9", text: "#475569" };
      const span = document.createElement("span");
      span.textContent = token.rawText;
      span.title = `${token.pos}${token.morph?.lemma ? ` · ${token.morph.lemma}` : ""}`;
      span.style.cssText = [
        `background:${colors.bg}`,
        `color:${colors.text}`,
        "border-radius:4px",
        "padding:1px 5px",
        "margin:0 1px",
        "cursor:pointer",
        "display:inline",
        "vertical-align:baseline",
        "box-sizing:border-box",
        "font-family:inherit",
        "font-size:inherit",
        "line-height:inherit",
      ].join(";");
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        onTokenClick(token);
      });
      container.appendChild(span);
    }

    cursor = token.absoluteOffset.end;
  }

  // Any trailing text after the last token
  if (cursor < originalText.length) {
    container.appendChild(document.createTextNode(originalText.slice(cursor)));
  }

  return container;
}

function injectAnnotation(
  savedRange: Range,
  tokens: Token[],
  originalText: string,
  onTokenClick: (token: Token) => void
): { container: HTMLSpanElement; fragment: DocumentFragment } {
  const fragment = savedRange.extractContents(); // removes selected DOM content, saves it
  const container = buildAnnotationContainer(tokens, originalText, onTokenClick);
  savedRange.insertNode(container); // inserts colored spans exactly where selection was
  return { container, fragment };
}

function clearAnnotation(container: HTMLSpanElement, fragment: DocumentFragment) {
  const parent = container.parentNode;
  if (!parent) return;
  parent.insertBefore(fragment, container); // restore original DOM content
  parent.removeChild(container);
}

// --- React app mounted in Shadow DOM ---

function PorpoiseApp() {
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarData, setSidebarData] = useState<{
    nlpResult: { sentences: Array<{ tokens: Token[] }> };
    translation: string;
    selectedText: string;
    language: string;
  } | null>(null);

  // Store the saved range and annotation ref between renders
  const savedRangeRef = useRef<Range | null>(null);
  const savedTextRef = useRef<string>("");
  const annotationRef = useRef<{ container: HTMLSpanElement; fragment: DocumentFragment } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      // Do not interfere if sidebar is already open
      if (sidebarData) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length < 2) return;
      if (text.length > 500) return; // cap to ~50 words; keeps reflow cheap and Babelscape cost low

      // Save range and text synchronously — before any async or state changes
      const range = selection!.getRangeAt(0);
      savedRangeRef.current = range.cloneRange();
      savedTextRef.current = text;

      setSelectionRect(range.getBoundingClientRect());
    };
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [sidebarData]);

  const handlePorpoiseClick = async () => {
    const text = savedTextRef.current;
    const savedRange = savedRangeRef.current;
    if (!text || !savedRange) return;

    const language = "IT"; // TODO: make user-selectable per session

    setIsLoading(true);
    setSidebarData(null);
    setSelectionRect(null);

    const [nlpRes, translateRes] = await Promise.all([
      fetch(`${API_BASE}/api/nlp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      }),
      fetch(`${API_BASE}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sourceLang: language }),
      }),
    ]);

    const nlpResult = await nlpRes.json();
    const { translation } = await translateRes.json();

    // Flatten all tokens across all sentences
    const allTokens: Token[] = nlpResult.sentences?.flatMap(
      (s: { tokens: Token[] }) => s.tokens
    ) ?? [];

    // Inject colored spans directly into the host page DOM
    annotationRef.current = injectAnnotation(
      savedRange,
      allTokens,
      text,
      handleTokenClickFromPage
    );

    setIsLoading(false);
    setSidebarData({ nlpResult, translation, selectedText: text, language });
  };

  const handleTokenClickFromPage = (token: Token) => {
    // Token clicked on the page → select it in the sidebar
    // Use a custom event to bridge the DOM→React boundary
    document.dispatchEvent(
      new CustomEvent("porpoise:token-click", { detail: token })
    );
  };

  const handleClose = () => {
    // Remove the colored spans from the page, restore original text
    if (annotationRef.current) {
      clearAnnotation(annotationRef.current.container, annotationRef.current.fragment);
      annotationRef.current = null;
    }
    setSidebarData(null);
    setSelectionRect(null);
    savedRangeRef.current = null;
    savedTextRef.current = "";
  };

  return (
    <>
      {selectionRect && !isLoading && !sidebarData && (
        <button
          onClick={handlePorpoiseClick}
          style={{
            position: "fixed",
            top: selectionRect.bottom + 6,
            left: selectionRect.left,
            zIndex: 2147483647,
            background: "#1d4ed8",
            color: "white",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            cursor: "pointer",
            fontSize: 16,
          }}
          title="Analyze with Porpoise"
        >
          🐬
        </button>
      )}
      {isLoading && selectionRect && (
        <LoadingPopup rect={selectionRect} />
      )}
      {sidebarData && (
        <Sidebar
          data={sidebarData}
          onClose={handleClose}
        />
      )}
    </>
  );
}

// Mount PorpoiseApp into Shadow DOM (Plasmo handles this automatically for .tsx content scripts)
// Use Plasmo's getStyle export to inject Tailwind CSS into the shadow root.
```

**Important**: Plasmo handles Shadow DOM injection natively for `.tsx` content scripts. Use Plasmo's `getStyle` export to inject Tailwind CSS into the shadow root. See Plasmo docs for the exact pattern.

**Cross-node selection caveat**: `range.extractContents()` works correctly when the selection is within a single block element (e.g., a `<p>` tag). If the user selects text that crosses block boundaries (e.g., from one `<p>` into another), the DOM manipulation may produce malformed nesting. For MVP, accept this limitation. A future fix is to detect cross-block selections and fall back to showing tokens only in the sidebar.

### Component: `extension/src/components/LoadingPopup.tsx`

```typescript
import React from "react";

export default function LoadingPopup({ rect }: { rect: DOMRect }) {
  return (
    <div
      style={{
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        zIndex: 2147483647,
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "8px 16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        color: "#334155",
      }}
    >
      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>🐬</span>
      Analyzing...
    </div>
  );
}
```

### Component: `extension/src/components/POSBox.tsx`

```typescript
import React from "react";
import { POS_COLORS } from "~lib/posColors";

type Props = {
  token: { rawText: string; pos: string };
  onClick: () => void;
  isSelected: boolean;
};

const NO_BOX = new Set(["PUNCT", "SYM", "X"]);

export default function POSBox({ token, onClick, isSelected }: Props) {
  if (NO_BOX.has(token.pos)) return <span>{token.rawText}</span>;

  const color = POS_COLORS[token.pos] ?? { bg: "#F1F5F9", text: "#475569" };

  return (
    <span
      onClick={onClick}
      style={{
        background: color.bg,
        color: color.text,
        borderRadius: 4,
        padding: "1px 4px",
        margin: "0 2px",
        cursor: "pointer",
        fontWeight: isSelected ? 700 : 400,
        outline: isSelected ? `2px solid ${color.text}` : "none",
        display: "inline-block",
      }}
    >
      {token.rawText}
    </span>
  );
}
```

### Component: `extension/src/components/Sidebar.tsx`

```typescript
import React, { useState, useEffect } from "react";
import POSBox from "./POSBox";

const API_BASE = process.env.PLASMO_PUBLIC_API_BASE_URL!;

type Token = {
  index: number;
  rawText: string;
  pos: string;
  morph?: {
    lemma?: string;
    inflectionCategories?: string[];
  };
};

type Props = {
  data: {
    nlpResult: { sentences: Array<{ tokens: Token[] }> };
    translation: string;
    selectedText: string;
    language: string;
  };
  onClose: () => void;
};

export default function Sidebar({ data, onClose }: Props) {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);

  // Listen for clicks on in-page token spans (bridged via custom event)
  useEffect(() => {
    const handler = (e: Event) => setSelectedToken((e as CustomEvent<Token>).detail);
    document.addEventListener("porpoise:token-click", handler);
    return () => document.removeEventListener("porpoise:token-click", handler);
  }, []);
  const [conjugation, setConjugation] = useState<Record<string, unknown> | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<number, "idle" | "saving" | "saved">>({});

  const tokens = data.nlpResult.sentences.flatMap((s) => s.tokens);

  const handleTokenClick = async (token: Token) => {
    setSelectedToken(token);
    setConjugation(null);

    if (token.pos === "VERB" || token.pos === "AUX") {
      const res = await fetch(`${API_BASE}/api/conjugate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordForm: token.rawText, language: data.language }),
      });
      if (res.ok) {
        const result = await res.json();
        setConjugation(result.conjugationTable ?? null);
      }
    }
  };

  const handleSave = async (token: Token) => {
    setSaveStatus((s) => ({ ...s, [token.index]: "saving" }));

    const session = await chrome.runtime.sendMessage({ type: "GET_SESSION" });
    if (!session?.session) {
      alert("Please log in to the Porpoise dashboard to save words.");
      setSaveStatus((s) => ({ ...s, [token.index]: "idle" }));
      return;
    }

    await fetch(`${API_BASE}/api/words`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        lemma: token.morph?.lemma ?? token.rawText,
        rawText: token.rawText,
        language: data.language,
        pos: token.pos,
        contextSentence: data.selectedText,
        translationEn: data.translation,
        morphData: token.morph ?? {},
      }),
    });

    setSaveStatus((s) => ({ ...s, [token.index]: "saved" }));
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 320,
        height: "100vh",
        background: "white",
        borderLeft: "1px solid #e2e8f0",
        zIndex: 2147483646,
        overflowY: "auto",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
        boxShadow: "-4px 0 16px rgba(0,0,0,0.1)",
      }}
    >
      {/* Header */}
      <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>🐬 Porpoise</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      {/* Translation */}
      <div style={{ padding: 16, background: "#F8FAFC", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 }}>Translation</div>
        <div style={{ color: "#1E293B" }}>{data.translation}</div>
      </div>

      {/* Token boxes */}
      <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", lineHeight: 2 }}>
        {tokens.map((token) => (
          <POSBox
            key={token.index}
            token={token}
            onClick={() => handleTokenClick(token)}
            isSelected={selectedToken?.index === token.index}
          />
        ))}
      </div>

      {/* Selected token detail */}
      {selectedToken && (
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{selectedToken.rawText}</div>
          <div style={{ color: "#64748B", marginBottom: 4 }}>
            {selectedToken.pos} {selectedToken.morph?.lemma ? `· lemma: ${selectedToken.morph.lemma}` : ""}
          </div>
          {selectedToken.morph?.inflectionCategories?.length ? (
            <div style={{ color: "#475569", marginBottom: 8 }}>
              {selectedToken.morph.inflectionCategories.join(", ")}
            </div>
          ) : null}

          {/* Conjugation table (verbs only) */}
          {conjugation && (
            <pre style={{ background: "#F1F5F9", padding: 8, borderRadius: 4, fontSize: 11, overflow: "auto", maxHeight: 200 }}>
              {JSON.stringify(conjugation, null, 2)}
            </pre>
          )}

          {/* Save button */}
          <button
            onClick={() => handleSave(selectedToken)}
            disabled={saveStatus[selectedToken.index] === "saving" || saveStatus[selectedToken.index] === "saved"}
            style={{
              marginTop: 8,
              padding: "6px 16px",
              background: saveStatus[selectedToken.index] === "saved" ? "#22C55E" : "#1D4ED8",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {saveStatus[selectedToken.index] === "saved" ? "Saved ✓" : "Save Word"}
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 10. Dashboard Pages

### Login: `dashboard/app/(auth)/login/page.tsx`

```typescript
"use client";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 p-8 border rounded-xl shadow-sm">
        <h1 className="text-2xl font-bold">Read With Porpoise</h1>
        <p className="text-muted-foreground">Sign in to save words and review with flashcards.</p>
        <button
          onClick={signInWithGoogle}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
```

### Dashboard Overview: `dashboard/app/dashboard/page.tsx`

Fetch `user_stats` server-side and display XP, level, streak, and total words saved.

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("id", user.id)
    .single();

  const xpToNextLevel = 100 - (stats?.xp ?? 0) % 100;

  return (
    <main className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">The Reef</h1>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Level" value={stats?.level ?? 1} />
        <StatCard label="XP" value={`${stats?.xp ?? 0} (${xpToNextLevel} to next)`} />
        <StatCard label="Streak" value={`${stats?.streak_count ?? 0} days`} />
        <StatCard label="Words Saved" value={stats?.total_words_saved ?? 0} />
      </div>
      <div className="flex gap-4">
        <a href="/dashboard/words" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
          My Words
        </a>
        <a href="/dashboard/review" className="px-4 py-2 bg-green-600 text-white rounded-lg">
          Review Now
        </a>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 border rounded-xl">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
```

### Words Page: `dashboard/app/dashboard/words/page.tsx`

Display a filterable table of saved words. Include delete functionality.

Key elements:
- Fetch all `saved_words` for the current user server-side
- Display in a table: `raw_text`, `pos` (badge), `language`, `translation_en`, `created_at`
- Filter buttons: All / IT / ES, and by POS
- Delete button per row calls `DELETE /api/words?id={id}` (add this to the `/api/words` route)

Add `DELETE` to `dashboard/app/api/words/route.ts`:

```typescript
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("saved_words").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
```

### Review Page: `dashboard/app/dashboard/review/page.tsx`

Flashcard SRS using the SM-2 algorithm.

**SM-2 Algorithm** (implement this exactly):
- Grade 0 (Again): `interval = 1`, `easeFactor = max(1.3, ef - 0.2)`
- Grade 1 (Hard): `interval = max(1, interval * 1.2)`, `easeFactor = max(1.3, ef - 0.15)`
- Grade 2 (Good): `interval = interval * easeFactor`
- Grade 3 (Easy): `interval = interval * easeFactor * 1.3`, `easeFactor = ef + 0.1`

After grading, set `next_review_at = now() + interval days` and update `review_interval_days` and `ease_factor` in `saved_words`.

The review UI:
1. Fetch all words where `next_review_at <= now()` ordered by `next_review_at asc`
2. Show one card at a time: front = `raw_text` in IT/ES, back (after flip) = `translation_en` + `pos` + `morph_data.inflectionCategories`
3. After flip, show 4 buttons: Again / Hard / Good / Easy
4. On button click: update the word via `PATCH /api/words` (add this handler)
5. Show progress bar: reviewed / total due

---

## 11. Running the Project

### Development

```bash
# Terminal 1: Dashboard
cd dashboard && npm run dev
# Runs on http://localhost:3000

# Terminal 2: Extension
cd extension && npm run dev
# Builds to extension/.plasmo/build/chrome-mv3-dev
```

### Load Extension in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked"
4. Select the folder: `extension/.plasmo/build/chrome-mv3-dev`
5. The Porpoise extension icon appears in the toolbar

---

## 12. Verification Checklist

Run through these tests in order. Each must pass before the next phase is considered complete.

**Phase 1 — API Routes:**
- [ ] `POST http://localhost:3000/api/nlp` with body `{"text":"mangiavo la pizza","language":"IT"}` returns JSON with `sentences` array containing tokens with `pos` and `morph` fields
- [ ] `POST http://localhost:3000/api/translate` with body `{"text":"mangiavo la pizza","sourceLang":"IT"}` returns `{"translation":"I was eating the pizza"}`
- [ ] `POST http://localhost:3000/api/conjugate` with body `{"wordForm":"mangiavo","language":"IT"}` returns `{"infinitive":"mangiare","conjugationTable":{...}}` with mood/tense structure
- [ ] `POST http://localhost:3000/api/conjugate` with body `{"wordForm":"comía","language":"ES"}` returns data for "comer"

**Phase 2 — Extension:**
- [ ] Navigate to any webpage, highlight Italian text → 🐬 icon appears near selection
- [ ] Click 🐬 → loading popup appears → sidebar slides in from right
- [ ] The selected text on the page is replaced in-place with color-coded POS boxes (NOUN=blue, VERB=orange, ADJ=green, etc.)
- [ ] Sidebar shows the DeepL translation at top and the same token list
- [ ] Click a colored box on the page → that token becomes selected/highlighted in the sidebar
- [ ] Click a VERB box → conjugation table appears in the sidebar detail panel
- [ ] Click "Save Word" → success state shown (green button)
- [ ] Close the sidebar (✕) → colored boxes removed, original page text restored

**Phase 3 — Dashboard:**
- [ ] `http://localhost:3000/login` → Google sign-in works
- [ ] After login, `http://localhost:3000/dashboard` shows stats (XP, level, streak)
- [ ] `http://localhost:3000/dashboard/words` shows saved words from the extension
- [ ] `http://localhost:3000/dashboard/review` shows flashcards for due words
- [ ] Grading a card (Easy/Good/Hard/Again) updates the word's `next_review_at` in Supabase
