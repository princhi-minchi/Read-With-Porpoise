# Conventions & Patterns

## Styling Rules

**Extension components** (`extension/src/components/`):
- Use **inline styles only** (`style={{ ... }}`). No Tailwind classes. No CSS modules.
- Reason: these components render in a Shadow DOM. Tailwind's stylesheet doesn't penetrate shadow roots without explicit injection via Plasmo's `getStyle` export, which hasn't been set up for components.
- Color palette: whites (#FFFFFF, #F8FAFC, #F1F5F9), slate borders (#e2e8f0), slate text (#1E293B, #64748B, #94A3B8), blue primary (#1D4ED8), green success (#22C55E).

**Dashboard** (`dashboard/`):
- Use **Tailwind CSS** classes + **shadcn/ui** components (slate base color, CSS variables).
- shadcn components installed: `button`, `card`, `badge`, `table`, `dialog`, `toast`, `progress`.
- Server components by default; add `"use client"` only when needed (event handlers, hooks).

## Extension-Specific Patterns

- **No React in the page DOM**: colored token `<span>` elements are created with `document.createElement`, not React. React only manages the Shadow DOM overlays.
- **Custom event bridge**: `porpoise:token-click` CustomEvent bridges clicks from the host-page DOM spans into the React sidebar. Dispatched on `document` from page-DOM click handlers, listened to in `Sidebar.tsx` via `useEffect`.
- **Auth always goes through the background**: content script never has direct access to Supabase. It sends `GET_SESSION`, `SIGN_IN_GOOGLE`, or `SIGN_OUT` messages to `background/index.ts`.
- **zIndex**: page-DOM annotation container has no z-index. Shadow DOM button uses `2147483647` (max). Sidebar uses `2147483646`.

## API Route Patterns (Dashboard)

- All routes in `dashboard/app/api/` use Next.js Route Handlers.
- Auth: call `supabase.auth.getUser()` (not `getSession()`) for server-side auth checks.
- Import server Supabase client from `@/lib/supabase/server` (SSR cookies-based).
- Return `NextResponse.json({ error: "..." }, { status: N })` for errors.

## Naming

- Files: `camelCase.ts` / `PascalCase.tsx` for components.
- DB columns: `snake_case` (Postgres convention).
- TypeScript types in extension: defined inline or at top of file, not in a separate `types/` directory.
- API request/response bodies: `camelCase` JSON keys (dashboard routes accept `camelCase`, map to `snake_case` for Supabase).

## SRS Algorithm (SM-2)

Implemented in the review page. Grades 0–3:
- 0 (Again): `interval = 1`, `ef = max(1.3, ef - 0.2)`
- 1 (Hard): `interval = max(1, interval * 1.2)`, `ef = max(1.3, ef - 0.15)`
- 2 (Good): `interval = interval * ef`
- 3 (Easy): `interval = interval * ef * 1.3`, `ef = ef + 0.1`

After grading: `next_review_at = now() + interval days`, update `review_interval_days` and `ease_factor`.
