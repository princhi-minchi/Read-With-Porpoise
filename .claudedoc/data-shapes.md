# Data Shapes

Reference for the actual API response formats used in this project.

---

## Conjugation Table (`/api/conjugate` response)

The `conjugationTable` field has this shape (example: "rimanere"):

```json
{
  "indicativo": {
    "presente":             ["io rimango", "tu rimani", "lui/lei rimane", "noi rimaniamo", "voi rimanete", "loro rimangono"],
    "imperfetto":           ["io rimanevo", ...],
    "passato_remoto":       ["io rimasi", ...],
    "futuro":               ["io rimarrò", ...],
    "passato_prossimo":     ["io sono rimasto/a", ...],
    "trapassato_prossimo":  ["io ero rimasto/a", ...],
    "trapassato_remoto":    ["io fui rimasto/a", ...],
    "futuro_anteriore":     ["io sarò rimasto/a", ...]
  },
  "condizionale": {
    "presente": ["io rimarrei", ...],
    "passato":  ["io sarei rimasto/a", ...]
  },
  "congiuntivo": {
    "presente":   ["che io rimanga", ...],
    "imperfetto": ["che io rimanessi", ...],
    "passato":    ["che io sia rimasto/a", ...],
    "trapassato": ["che io fossi rimasto/a", ...]
  },
  "imperativo": {
    "presente": ["rimani", "rimanga", "rimaniamo", "rimanete", "rimangano"]
  },
  "gerundio": {
    "presente": "rimanendo",
    "passato":  "essendo rimasto/a"
  },
  "participio": {
    "presente": "rimanente",
    "passato":  "rimasto"
  },
  "infinito": {
    "presente": "rimanere",
    "passato":  "essere rimasto/a"
  }
}
```

**Key facts about this shape:**
- Top-level keys are mood names in Italian (lowercase): `indicativo`, `condizionale`, `congiuntivo`, `imperativo`, `gerundio`, `participio`, `infinito`
- Each mood maps to an object where keys are tense names (snake_case Italian): `presente`, `imperfetto`, `passato_remoto`, etc.
- Conjugated moods (`indicativo`, `condizionale`, `congiuntivo`) have arrays of 6 strings: `["io ...", "tu ...", "lui/lei ...", "noi ...", "voi ...", "loro ..."]`
- `imperativo.presente` has 5 strings (no "io" form)
- `gerundio`, `participio`, `infinito` values are plain strings, not arrays
- The actual clicked word form will appear somewhere in the arrays (e.g. "rimase" in passato_remoto)

---

## NLP Token (`/api/nlp` response, Babelscape)

```typescript
type Token = {
  index: number;
  rawText: string;
  pos: string;                          // "NOUN" | "VERB" | "AUX" | "ADJ" | "ADV" | "DET" | "PRON" | "ADP" | "CCONJ" | "SCONJ" | "PROPN" | "NUM" | "PART" | "INTJ" | "PUNCT" | "SYM" | "X"
  absoluteOffset: { start: number; end: number };
  morph?: {
    lemma?: string;
    inflectionCategories?: string[];    // e.g. ["THIRD_PERSON", "SINGULAR", "INDICATIVE", "PAST_HISTORIC"]
  };
};
```

Response structure: `{ sentences: Array<{ tokens: Token[] }> }`

---

## Saved Word (Supabase `saved_words` table)

```typescript
{
  id: string;               // uuid
  user_id: string;          // uuid, references auth.users
  lemma: string;            // base form (from morph.lemma)
  raw_text: string;         // exact form as it appeared on the page
  language: "IT" | "ES";
  pos: string;              // POS tag
  context_sentence: string; // the full selected text
  translation_en: string;   // DeepL translation
  morph_data: object;       // full morph object from Babelscape
  next_review_at: string;   // ISO timestamp
  review_interval_days: number;   // SRS interval, starts at 1
  ease_factor: number;            // SM-2 ease factor, starts at 2.5
  xp_value: number;               // default 10
  created_at: string;
}
```

---

## POS Color Map

Defined in `extension/src/lib/posColors.ts`. `PUNCT`, `SYM`, `X` render as plain text (no box).

| POS | Background | Text |
|---|---|---|
| NOUN | #BFDBFE | #1E3A5F |
| VERB | #FED7AA | #7C2D12 |
| AUX | #FDE68A | #78350F |
| ADJ | #BBF7D0 | #14532D |
| ADV | #99F6E4 | #134E4A |
| DET | #E9D5FF | #4C1D95 |
| PRON | #FBCFE8 | #831843 |
| ADP | #E2E8F0 | #1E293B |
| CCONJ/SCONJ | #E5E7EB | #1F2937 |
| PROPN | #C7D2FE | #1E1B4B |
| NUM | #FEF9C3 | #713F12 |
| PART | #F1F5F9 | #475569 |
| INTJ | #FCE7F3 | #831843 |
