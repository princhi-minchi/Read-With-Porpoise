# Active Task

## Current: Conjugation Table UI

**Status**: Pending — design not yet specified in full, implementation not started.

**Problem**: When a user clicks a VERB or AUX token in the sidebar, the conjugation data is fetched from `/api/conjugate` and displayed as a raw `JSON.stringify` dump in a `<pre>` block inside `Sidebar.tsx` (line ~142).

**Location**: [extension/src/components/Sidebar.tsx](../extension/src/components/Sidebar.tsx), line 142–144:
```tsx
{conjugation && (
  <pre style={{ background: "#F1F5F9", padding: 8, borderRadius: 4, fontSize: 11, overflow: "auto", maxHeight: 200 }}>
    {JSON.stringify(conjugation, null, 2)}
  </pre>
)}
```

**Goal**: Replace the `<pre>` block with a purpose-built `ConjugationTable` component that renders the data in a structured, readable UI. The design is to be determined by the user before implementation.

**Data shape available**: See [data-shapes.md](./data-shapes.md#conjugation-table-apiconiugate-response) for the full JSON structure.

**Constraints**:
- Must use inline styles only (no Tailwind) — extension Shadow DOM context.
- The new component should live at `extension/src/components/ConjugationTable.tsx`.
- Should accept `conjugationTable: Record<string, unknown>` and optionally the `clickedForm: string` (the `token.rawText`) to highlight the matching row in the table.

---

## Completed Guides

All 5 agent guides have been implemented:
- [x] 01 — Monorepo scaffold
- [x] 02 — Supabase schema
- [x] 03 — Next.js API backend (NLP, translate, conjugate, words routes)
- [x] 04 — Extension (content script, sidebar, background worker, POSBox, LoadingPopup)
- [x] 05 — Dashboard pages (login, overview, words, review)
