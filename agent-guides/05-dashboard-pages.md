# Guide 05 — Dashboard Pages

## What This Guide Builds

All Next.js UI pages: login (Google OAuth), dashboard overview (XP/level/streak), saved words management (filterable table with delete), and SRS flashcard review (SM-2 algorithm). After this guide, the full dashboard is usable and the extension's "Save Word" feature works end-to-end.

## Prerequisites

- Guides 01–03 complete (monorepo scaffolded, Supabase schema deployed, API routes running).
- `dashboard/.env.local` has real values for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Guide 02 Google Auth configured (Supabase → Authentication → Providers → Google enabled).

## Environment Variables Used

From `dashboard/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Tech Stack

- Next.js 14 App Router
- Tailwind CSS + shadcn/ui (slate theme, already installed)
- Supabase SSR client (already set up in Guide 03)

---

## Step 1 — Root Layout

**File: `dashboard/app/layout.tsx`**
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Read With Porpoise",
  description: "Language learning with spaced repetition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

---

## Step 2 — Root Page (redirect)

**File: `dashboard/app/page.tsx`**
```typescript
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
```

---

## Step 3 — Login Page

Supabase Google OAuth. On success, Supabase redirects back to `/dashboard`.

**File: `dashboard/app/(auth)/login/page.tsx`**
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Read With Porpoise 🐬</h1>
          <p className="text-sm text-slate-500">
            Sign in to save words and review with flashcards.
          </p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
```

---

## Step 4 — Dashboard Overview Page

Server-side render. Reads `user_stats` for the logged-in user. Redirects to `/login` if not authenticated.

**File: `dashboard/app/dashboard/page.tsx`**
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
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <h1 className="text-3xl font-bold">The Reef 🪸</h1>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Level" value={stats?.level ?? 1} />
        <StatCard label="XP" value={`${stats?.xp ?? 0} (${xpToNextLevel} to next)`} />
        <StatCard label="Streak" value={`${stats?.streak_count ?? 0} days 🔥`} />
        <StatCard label="Words Saved" value={stats?.total_words_saved ?? 0} />
      </div>
      <div className="flex gap-3">
        <a
          href="/dashboard/words"
          className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700"
        >
          My Words
        </a>
        <a
          href="/dashboard/review"
          className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700"
        >
          Review Now
        </a>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
```

---

## Step 5 — Saved Words Page

Filterable, deletable table of all saved words. Client component for filter interactivity.

**File: `dashboard/app/dashboard/words/page.tsx`**
```typescript
"use client";
import { useEffect, useState } from "react";

type Word = {
  id: string;
  raw_text: string;
  lemma: string;
  language: string;
  pos: string;
  translation_en: string;
  created_at: string;
};

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [language, setLanguage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchWords = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (language) params.set("language", language);
    const res = await fetch(`/api/words?${params}`);
    const data = await res.json();
    setWords(data.words ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchWords(); }, [language]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/words?id=${id}`, { method: "DELETE" });
    setWords((w) => w.filter((word) => word.id !== id));
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Words</h1>
        <a href="/dashboard" className="text-sm text-slate-500 hover:underline">← Back</a>
      </div>
      <div className="flex gap-2">
        {["", "IT", "ES"].map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`rounded-full px-4 py-1 text-sm font-medium border transition-colors ${
              language === lang
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
            }`}
          >
            {lang || "All"}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : words.length === 0 ? (
        <p className="text-slate-400">No words saved yet. Use the extension to save words.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Word</th>
                <th className="px-4 py-3">Lemma</th>
                <th className="px-4 py-3">POS</th>
                <th className="px-4 py-3">Lang</th>
                <th className="px-4 py-3">Translation</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {words.map((word) => (
                <tr key={word.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{word.raw_text}</td>
                  <td className="px-4 py-3 text-slate-500">{word.lemma}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono">
                      {word.pos}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{word.language}</td>
                  <td className="px-4 py-3 text-slate-500">{word.translation_en}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(word.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

---

## Step 6 — SRS Review Page

Flashcard review using the SM-2 spaced repetition algorithm.

**SM-2 Algorithm — implement exactly as follows:**

Given current `interval` (days) and `easeFactor` (float, starts at 2.5):

| Button | Grade | New interval | New easeFactor |
|---|---|---|---|
| Again | 0 | `1` | `max(1.3, ef - 0.2)` |
| Hard | 1 | `max(1, interval * 1.2)` | `max(1.3, ef - 0.15)` |
| Good | 2 | `interval * easeFactor` | unchanged |
| Easy | 3 | `interval * easeFactor * 1.3` | `ef + 0.1` |

After grading: set `next_review_at = now() + new_interval days`, save `review_interval_days` and `ease_factor` via `PATCH /api/words`.

**File: `dashboard/app/dashboard/review/page.tsx`**
```typescript
"use client";
import { useEffect, useState } from "react";

type Word = {
  id: string;
  raw_text: string;
  translation_en: string;
  pos: string;
  language: string;
  morph_data: { inflectionCategories?: string[] } | null;
  review_interval_days: number;
  ease_factor: number;
};

export default function ReviewPage() {
  const [dueWords, setDueWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/words?due_for_review=true")
      .then((r) => r.json())
      .then((data) => {
        setDueWords(data.words ?? []);
        setLoading(false);
      });
  }, []);

  const current = dueWords[currentIndex];
  const total = dueWords.length;

  const grade = async (gradeValue: 0 | 1 | 2 | 3) => {
    if (!current) return;

    const ef = current.ease_factor;
    const interval = current.review_interval_days;

    let newInterval: number;
    let newEf: number;

    if (gradeValue === 0) {
      newInterval = 1;
      newEf = Math.max(1.3, ef - 0.2);
    } else if (gradeValue === 1) {
      newInterval = Math.max(1, interval * 1.2);
      newEf = Math.max(1.3, ef - 0.15);
    } else if (gradeValue === 2) {
      newInterval = interval * ef;
      newEf = ef;
    } else {
      newInterval = interval * ef * 1.3;
      newEf = ef + 0.1;
    }

    const nextReviewAt = new Date(
      Date.now() + newInterval * 24 * 60 * 60 * 1000
    ).toISOString();

    await fetch("/api/words", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: current.id,
        nextReviewAt,
        reviewIntervalDays: newInterval,
        easeFactor: newEf,
      }),
    });

    setReviewed((r) => r + 1);
    setFlipped(false);
    setCurrentIndex((i) => i + 1);
  };

  if (loading) return <main className="p-8 text-slate-400">Loading...</main>;

  if (currentIndex >= total) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold">All done!</h1>
        <p className="text-slate-500">You reviewed {reviewed} word{reviewed !== 1 ? "s" : ""}.</p>
        <a href="/dashboard" className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white font-semibold hover:bg-blue-700">
          Back to Dashboard
        </a>
      </main>
    );
  }

  const progressPct = total > 0 ? Math.round((currentIndex / total) * 100) : 0;

  return (
    <main className="mx-auto max-w-lg space-y-6 p-8">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{currentIndex} / {total} reviewed</span>
        <a href="/dashboard" className="hover:underline">← Back</a>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-blue-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div
        onClick={() => setFlipped(true)}
        className="min-h-48 cursor-pointer rounded-2xl border bg-white p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-3 hover:shadow-md transition-shadow"
      >
        <div className="text-3xl font-bold text-slate-900">{current.raw_text}</div>
        <div className="text-xs font-mono text-slate-400">{current.language} · {current.pos}</div>
        {!flipped ? (
          <p className="text-sm text-slate-400 mt-4">Click to reveal</p>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="text-lg text-slate-700">{current.translation_en}</div>
            {current.morph_data?.inflectionCategories?.length ? (
              <div className="text-xs text-slate-400">
                {current.morph_data.inflectionCategories.join(", ")}
              </div>
            ) : null}
          </div>
        )}
      </div>
      {flipped && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Again", grade: 0 as const, color: "bg-red-500 hover:bg-red-600" },
            { label: "Hard", grade: 1 as const, color: "bg-orange-500 hover:bg-orange-600" },
            { label: "Good", grade: 2 as const, color: "bg-blue-500 hover:bg-blue-600" },
            { label: "Easy", grade: 3 as const, color: "bg-emerald-500 hover:bg-emerald-600" },
          ].map(({ label, grade: g, color }) => (
            <button
              key={label}
              onClick={() => grade(g)}
              className={`rounded-lg py-3 font-semibold text-white transition-colors ${color}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
```

---

## Step 7 — Run the Dashboard

```bash
cd dashboard && npm run dev
```

Dashboard runs at `http://localhost:3000`.

---

## Verification Checklist

Complete all items in order.

> **Playwright MCP available**: Use `mcp__playwright__browser_navigate` to open pages and `mcp__playwright__browser_snapshot` to inspect rendered content instead of checking manually. For clicks, use `mcp__playwright__browser_click`. The Google OAuth step still requires human interaction.

- [ ] `http://localhost:3000/login` loads a sign-in page with a "Continue with Google" button. No console errors.
- [ ] Clicking "Continue with Google" opens a Google OAuth flow and, after sign-in, redirects to `http://localhost:3000/dashboard`. *(Human step — OAuth requires browser interaction.)*
- [ ] `http://localhost:3000/dashboard` shows the stats cards (Level, XP, Streak, Words Saved). All values are numbers (not undefined or NaN). "Words Saved" starts at 0 if no words have been saved yet.
- [ ] `http://localhost:3000/dashboard/words` shows either a "No words saved yet" message or a table of words if any were saved via the extension.
- [ ] Use the extension (Guide 04) to save at least one word, then refresh `/dashboard/words` — the saved word appears in the table.
- [ ] Delete the word using the Delete button — it disappears from the table immediately.
- [ ] `http://localhost:3000/dashboard/review` shows either "All done! 🎉" (if no words are due) or a flashcard.
- [ ] On a flashcard: click the card → translation appears. Click "Good" → card advances. Verify via `mcp__supabase__execute_sql`: `select next_review_at, review_interval_days from public.saved_words limit 5;` — confirm `next_review_at` is a future date and `review_interval_days` has changed from the default of `1`.
