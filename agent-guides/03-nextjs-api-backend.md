# Guide 03 — Next.js API Backend

## What This Guide Builds

The full Next.js server-side layer: Supabase client helpers, Cloudflare KV verb lookup logic, and all four API routes (`/api/nlp`, `/api/translate`, `/api/conjugate`, `/api/words`). After this guide, all API routes are testable via curl/fetch and ready for the extension to call.

## Prerequisites

- Guide 01 complete (monorepo scaffold exists).
- Guide 02 complete (Supabase schema deployed, env vars filled in).
- `dashboard/.env.local` has real values for all keys below.

## Environment Variables Used in This Guide

All of these must be set in `dashboard/.env.local` before running:

```env
BABELSCAPE_API_KEY=           # from babelscape.com account
DEEPL_API_KEY=                # from deepl.com account (free tier key)

NEXT_PUBLIC_SUPABASE_URL=     # https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

CF_ACCOUNT_ID=                # Cloudflare dashboard → right sidebar
CF_API_TOKEN=                 # Cloudflare → My Profile → API Tokens → create token with KV:Read permission
CF_KV_NS_VERB_IT=             # VERB_DB namespace ID — retrieve via MCP (see Step 0 below)
CF_KV_NS_VERB_ES=             # SPANISH_VERB_DB namespace ID
CF_KV_NS_REVERSE_IT=          # REVERSE_DB_V2 namespace ID
CF_KV_NS_REVERSE_ES=          # SPANISH_REVERSE_DB namespace ID
```

## Step 0 — Retrieve Cloudflare KV Namespace IDs via MCP

The four `CF_KV_NS_*` values are namespace IDs that can be fetched without opening the Cloudflare dashboard.

1. Call `mcp__cloudflare-bindings__set_active_account` with your `CF_ACCOUNT_ID` (found in the Cloudflare dashboard right sidebar).
2. Call `mcp__cloudflare-bindings__kv_namespaces_list` — this returns all KV namespaces with their IDs and titles.
3. Match the titles to populate `.env.local`:

| `.env.local` key | KV namespace title |
|---|---|
| `CF_KV_NS_VERB_IT` | `VERB_DB` |
| `CF_KV_NS_VERB_ES` | `SPANISH_VERB_DB` |
| `CF_KV_NS_REVERSE_IT` | `REVERSE_DB_V2` |
| `CF_KV_NS_REVERSE_ES` | `SPANISH_REVERSE_DB` |

> **Note:** `CF_ACCOUNT_ID` and `CF_API_TOKEN` must still be obtained manually from the Cloudflare dashboard. The MCP server uses its own credentials to list namespaces, but the app's runtime KV access goes through the REST API using these env vars.

## Key Architecture Decisions

- The dashboard is a **Next.js 14 App Router** project.
- API routes live in `dashboard/app/api/`.
- Supabase is accessed from API routes using the **service role key** (server-side only). The browser client uses the anon key.
- Cloudflare KV is queried via the **Cloudflare REST API** — no Cloudflare Worker is called. The lookup logic is reimplemented here.
- DeepL translates FROM Italian (IT) or Spanish (ES) TO English (EN) — always.
- Babelscape is called with the full selected text; results are cached in the `lemma_cache` table.

---

## Step 1 — Supabase Client Helpers

**File: `dashboard/lib/supabase/client.ts`**
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**File: `dashboard/lib/supabase/server.ts`**
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

---

## Step 2 — Cloudflare KV Lookup Logic

This file contains the full verb conjugation lookup algorithm. It queries Cloudflare KV via the REST API.

**Cloudflare KV data structure:**

For Italian, the reverse-lookup (conjugated form → infinitive) uses the `REVERSE_DB_V2` namespace with 3 strategies tried in order:
- `it:rev:v2:surface:{first-2-chars}` — exact surface form
- `it:rev:v2:norm:{first-2-chars}` — lowercased + NFC normalised
- `it:rev:v2:accentless:{first-2-chars}` — accents stripped

For Spanish, the reverse-lookup uses `SPANISH_REVERSE_DB` with 1 strategy:
- `es:rev:norm:{first-2-chars}` — lowercased + NFC normalised

Each shard value is a JSON object: `{ "wordform": ["infinitive1", ...] }`

Verb data (full conjugation table) is stored in:
- Italian: `VERB_DB` namespace, key `verb:{infinitive}`
- Spanish: `SPANISH_VERB_DB` namespace, key `verb:{infinitive}`

Value format: nested JSON `{ moods: { indicativo: { presente: ["io form", "tu form", ...] } } }`

**File: `dashboard/lib/cloudflare/kv.ts`**
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
): Promise<{ infinitive: string; conjugationTable: Record<string, unknown> } | null> {
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

## Step 3 — API Route: `/api/nlp`

Proxies text to Babelscape NLP API. Caches individual lemma results in Supabase to avoid duplicate calls.

**Babelscape API**: `POST https://api.babelscape.com/v1/nlp-pipeline/query`
Query params: `key`, `text`, `language` (e.g. `"IT"` or `"ES"`)
Returns: `{ sentences: [{ tokens: [{ rawText, pos, morph: { lemma, inflectionCategories }, absoluteOffset }] }], languageDetect }`

**File: `dashboard/app/api/nlp/route.ts`**
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

  // Cache individual lemmas — fire and forget, do not await
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

---

## Step 4 — API Route: `/api/translate`

Proxies text to the DeepL Free API, always translating to English.

**DeepL API**: `POST https://api-free.deepl.com/v2/translate`
Body (form-encoded): `text`, `source_lang`, `target_lang`
Auth header: `DeepL-Auth-Key {key}`

**File: `dashboard/app/api/translate/route.ts`**
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

---

## Step 5 — API Route: `/api/conjugate`

Looks up verb conjugation from Cloudflare KV using the logic from Step 2.

**File: `dashboard/app/api/conjugate/route.ts`**
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

---

## Step 6 — API Route: `/api/words`

Full CRUD for saved words. Requires an authenticated user. Supports GET (list), POST (save), DELETE (remove), PATCH (update SRS fields after review).

**File: `dashboard/app/api/words/route.ts`**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  await supabase.rpc("increment_user_stats", { user_id_param: user.id });

  return NextResponse.json({ word });
}

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

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, nextReviewAt, reviewIntervalDays, easeFactor } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("saved_words")
    .update({
      next_review_at: nextReviewAt,
      review_interval_days: reviewIntervalDays,
      ease_factor: easeFactor,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

---

## Step 7 — Start the Dev Server

```bash
cd dashboard && npm run dev
```

The server must be running on `http://localhost:3000` to run the verification tests below.

---

## Verification Checklist

Run each test with the dev server running. Replace the example values with your own if needed.

- [ ] **NLP route**: `POST http://localhost:3000/api/nlp` with body `{"text":"mangiavo la pizza","language":"IT"}` returns a JSON object with a `sentences` array. Each sentence contains `tokens` with `pos` and `morph` fields. Example token: `{ "rawText": "mangiavo", "pos": "VERB", "morph": { "lemma": "mangiare" } }`.

- [ ] **Translate route**: `POST http://localhost:3000/api/translate` with body `{"text":"mangiavo la pizza","sourceLang":"IT"}` returns `{"translation":"I was eating the pizza"}` (exact wording may vary).

- [ ] **Conjugate route (Italian)**: `POST http://localhost:3000/api/conjugate` with body `{"wordForm":"mangiavo","language":"IT"}` returns `{"infinitive":"mangiare","conjugationTable":{...}}` where `conjugationTable` contains nested mood/tense data.

- [ ] **Conjugate route (Spanish)**: `POST http://localhost:3000/api/conjugate` with body `{"wordForm":"comía","language":"ES"}` returns `{"infinitive":"comer","conjugationTable":{...}}`.

- [ ] **Words route**: `GET http://localhost:3000/api/words` returns `{"error":"Unauthorized"}` with status 401 (correct — no auth token provided).

**How to run these tests** (choose one):
```bash
# Using curl
curl -X POST http://localhost:3000/api/nlp \
  -H "Content-Type: application/json" \
  -d '{"text":"mangiavo la pizza","language":"IT"}'
```

Or use Playwright MCP to run fetch calls in the browser — call `mcp__playwright__browser_navigate` to open `http://localhost:3000`, then `mcp__playwright__browser_evaluate` with:
```js
fetch("/api/nlp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "mangiavo la pizza", language: "IT" })
}).then(r => r.json())
```
This avoids CORS issues and lets you inspect the JSON response directly.
