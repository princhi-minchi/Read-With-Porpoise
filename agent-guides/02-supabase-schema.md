# Guide 02 — Supabase Schema

## What This Guide Builds

All Postgres tables, RLS policies, database functions, and auth configuration in Supabase. After this guide, the database is fully ready for the API routes in Guide 03.

## Prerequisites

- Guide 01 complete.
- A Supabase project created at [supabase.com](https://supabase.com). Free tier is sufficient.
- You have the following values from your Supabase project settings (Settings → API):
  - Project URL (format: `https://xxxxxxxxxxxx.supabase.co`)
  - `anon` public key
  - `service_role` secret key

## Human Steps Required

This guide requires you to manually run SQL in the Supabase SQL editor and configure Auth providers. The AI cannot do this — you must do it yourself.

**How to open the SQL editor**: Supabase Dashboard → SQL Editor → New Query

---

## Step 1 — Enable Extensions

Run in the SQL editor:

```sql
create extension if not exists "uuid-ossp";
```

---

## Step 2 — Create `user_stats` Table

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

---

## Step 3 — Create `saved_words` Table

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

---

## Step 4 — Create `lemma_cache` Table

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

This table has no RLS — it is read/written only from server-side API routes using the service role key.

---

## Step 5 — Create the New User Trigger

Automatically creates a `user_stats` row whenever a new user signs up:

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

---

## Step 6 — Create the Stats Update Function

Atomically increments XP, updates level, manages streak, and counts saved words:

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

## Step 7 — Configure Google Auth

In the Supabase dashboard:

1. Go to **Authentication → Providers → Google**
2. Toggle **Enable** to on
3. Add your Google OAuth **Client ID** and **Client Secret**
   - Get these from [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorised redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`
4. Save

---

## Step 8 — Fill In Environment Variable Values

Now that your Supabase project is configured, fill in the values in `dashboard/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Also fill in `extension/.env.development` and `extension/.env.production`:

```env
PLASMO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Verification Checklist

Complete all items before starting Guide 03.

- [ ] In Supabase Table Editor: tables `saved_words`, `user_stats`, and `lemma_cache` are all visible.
- [ ] Run this SQL — it should succeed (returns a row):
  ```sql
  select * from public.lemma_cache limit 1;
  ```
- [ ] Run this SQL — it should be blocked by RLS (returns 0 rows when run as anon):
  ```sql
  set role anon;
  select * from public.saved_words;
  reset role;
  ```
- [ ] In Supabase Dashboard → Authentication → Providers: Google provider shows as **Enabled**.
- [ ] `dashboard/.env.local` has real values (not empty) for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
