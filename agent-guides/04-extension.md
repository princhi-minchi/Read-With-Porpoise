# Guide 04 — Chrome Extension

## What This Guide Builds

The full Plasmo Chrome extension: background service worker (Supabase auth via `chrome.storage.local`), content script (selection listener, in-page POS box annotation, Shadow DOM sidebar injector), and all UI components (Sidebar, POSBox, LoadingPopup). After this guide, the extension is loadable in Chrome and the full highlight → annotate → sidebar → save flow works.

## Prerequisites

- Guide 01 complete (Plasmo project scaffolded at `/extension`).
- Guide 03 running (`cd dashboard && npm run dev` — the extension calls `http://localhost:3000` in dev).
- `extension/.env.development` has real Supabase URL and anon key.
- `extension/src/lib/posColors.ts` exists (created in Guide 01).

## Environment Variables Used

From `extension/.env.development`:
```env
PLASMO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
PLASMO_PUBLIC_API_BASE_URL=http://localhost:3000
```

## Key Architecture

**Two separate rendering layers — do not mix them:**

| Layer | What lives here | Technology |
|---|---|---|
| Shadow DOM | Porpoise button, LoadingPopup, Sidebar | React (Plasmo manages mount) |
| Host page DOM | Colour-coded token `<span>` elements | Plain DOM manipulation (no React) |

**Critical implementation rule**: `window.getSelection()` is cleared the moment the user clicks the Porpoise button. The `Range` object and selected text string MUST be saved synchronously in `useRef` inside the `mouseup` handler — before any state updates or async calls.

---

## Step 1 — Update Extension Manifest Permissions

Edit `extension/package.json` and add a `manifest` key. Merge with any existing content — do not overwrite the whole file:

```json
{
  "manifest": {
    "host_permissions": ["<all_urls>"],
    "permissions": ["storage", "identity"]
  }
}
```

---

## Step 2 — Background Service Worker

Manages Supabase auth in `chrome.storage.local` (cookies cannot be used in extensions). Responds to messages from the content script.

**File: `extension/src/background/index.ts`**
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
    return true; // keeps the message channel open for async response
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

---

## Step 3 — LoadingPopup Component

Small popover anchored below the selection, shown while API calls are in flight.

**File: `extension/src/components/LoadingPopup.tsx`**
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
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <span>🐬</span>
      Analyzing...
    </div>
  );
}
```

---

## Step 4 — POSBox Component

Renders a single token as a coloured box inside the Sidebar token list. PUNCT/SYM/X tokens render as plain text.

**File: `extension/src/components/POSBox.tsx`**
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
  if (NO_BOX.has(token.pos)) return <span>{token.rawText} </span>;

  const color = POS_COLORS[token.pos] ?? { bg: "#F1F5F9", text: "#475569" };

  return (
    <span
      onClick={onClick}
      style={{
        background: color.bg,
        color: color.text,
        borderRadius: 4,
        padding: "1px 5px",
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

---

## Step 5 — Sidebar Component

Fixed 320px right panel rendered in the Shadow DOM. Shows translation, token list (using POSBox), selected token details, conjugation table (for verbs), and save button.

**File: `extension/src/components/Sidebar.tsx`**
```typescript
import React, { useState, useEffect } from "react";
import POSBox from "./POSBox";

const API_BASE = process.env.PLASMO_PUBLIC_API_BASE_URL!;

type Token = {
  index: number;
  rawText: string;
  pos: string;
  absoluteOffset: { start: number; end: number };
  morph?: { lemma?: string; inflectionCategories?: string[] };
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
  const [conjugation, setConjugation] = useState<Record<string, unknown> | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<number, "idle" | "saving" | "saved">>({});

  // Listen for clicks on in-page token spans (bridged from page DOM via custom event)
  useEffect(() => {
    const handler = (e: Event) => setSelectedToken((e as CustomEvent<Token>).detail);
    document.addEventListener("porpoise:token-click", handler);
    return () => document.removeEventListener("porpoise:token-click", handler);
  }, []);

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
    const sessionResponse = await chrome.runtime.sendMessage({ type: "GET_SESSION" });
    if (!sessionResponse?.session) {
      alert("Please sign in to the Porpoise dashboard to save words.");
      setSaveStatus((s) => ({ ...s, [token.index]: "idle" }));
      return;
    }
    await fetch(`${API_BASE}/api/words`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionResponse.session.access_token}`,
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
      <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>🐬 Porpoise</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>
      <div style={{ padding: 16, background: "#F8FAFC", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 }}>Translation</div>
        <div style={{ color: "#1E293B" }}>{data.translation}</div>
      </div>
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
      {selectedToken && (
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{selectedToken.rawText}</div>
          <div style={{ color: "#64748B", marginBottom: 4 }}>
            {selectedToken.pos}{selectedToken.morph?.lemma ? ` · lemma: ${selectedToken.morph.lemma}` : ""}
          </div>
          {selectedToken.morph?.inflectionCategories?.length ? (
            <div style={{ color: "#475569", marginBottom: 8 }}>
              {selectedToken.morph.inflectionCategories.join(", ")}
            </div>
          ) : null}
          {conjugation && (
            <pre style={{ background: "#F1F5F9", padding: 8, borderRadius: 4, fontSize: 11, overflow: "auto", maxHeight: 200 }}>
              {JSON.stringify(conjugation, null, 2)}
            </pre>
          )}
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

## Step 6 — Content Script

This is the core of the extension. Two responsibilities:
1. **In-page DOM annotation** — injects coloured `<span>` elements directly into the host page's text (plain DOM, not React)
2. **Shadow DOM UI** — mounts the Porpoise button, LoadingPopup, and Sidebar into a Shadow DOM host (React)

**File: `extension/src/contents/main.tsx`**
```typescript
import type { PlasmoCSConfig } from "plasmo";
import { useState, useEffect, useRef } from "react";
import Sidebar from "~components/Sidebar";
import LoadingPopup from "~components/LoadingPopup";
import { POS_COLORS } from "~lib/posColors";

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
};

const API_BASE = process.env.PLASMO_PUBLIC_API_BASE_URL!;
const NO_BOX_POS = new Set(["PUNCT", "SYM", "X"]);

// --- Types ---

type Token = {
  index: number;
  rawText: string;
  pos: string;
  absoluteOffset: { start: number; end: number };
  morph?: { lemma?: string; inflectionCategories?: string[] };
};

// --- In-page DOM annotation helpers (plain DOM, not React) ---

function buildAnnotationContainer(
  tokens: Token[],
  originalText: string,
  onTokenClick: (token: Token) => void
): HTMLSpanElement {
  const container = document.createElement("span");
  container.setAttribute("data-porpoise", "annotated");

  let cursor = 0;
  for (const token of tokens) {
    if (token.absoluteOffset.start > cursor) {
      container.appendChild(
        document.createTextNode(originalText.slice(cursor, token.absoluteOffset.start))
      );
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
  const fragment = savedRange.extractContents();
  const container = buildAnnotationContainer(tokens, originalText, onTokenClick);
  savedRange.insertNode(container);
  return { container, fragment };
}

function clearAnnotation(container: HTMLSpanElement, fragment: DocumentFragment) {
  const parent = container.parentNode;
  if (!parent) return;
  parent.insertBefore(fragment, container);
  parent.removeChild(container);
}

// --- React app (Shadow DOM) ---

function PorpoiseApp() {
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarData, setSidebarData] = useState<{
    nlpResult: { sentences: Array<{ tokens: Token[] }> };
    translation: string;
    selectedText: string;
    language: string;
  } | null>(null);

  const savedRangeRef = useRef<Range | null>(null);
  const savedTextRef = useRef<string>("");
  const annotationRef = useRef<{ container: HTMLSpanElement; fragment: DocumentFragment } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      if (sidebarData) return;
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length < 2) return;
      if (text.length > 500) return; // cap: keeps reflow cheap + Babelscape cost low
      const range = selection!.getRangeAt(0);
      // Save synchronously — selection is cleared on next click
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

    const allTokens: Token[] = nlpResult.sentences?.flatMap(
      (s: { tokens: Token[] }) => s.tokens
    ) ?? [];

    // Inject coloured spans into the host page DOM
    annotationRef.current = injectAnnotation(
      savedRange,
      allTokens,
      text,
      (token) => document.dispatchEvent(new CustomEvent("porpoise:token-click", { detail: token }))
    );

    setIsLoading(false);
    setSidebarData({ nlpResult, translation, selectedText: text, language });
  };

  const handleClose = () => {
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
      {isLoading && selectionRect && <LoadingPopup rect={selectionRect} />}
      {sidebarData && <Sidebar data={sidebarData} onClose={handleClose} />}
    </>
  );
}

export default PorpoiseApp;
```

**Note on Plasmo Shadow DOM**: Plasmo automatically mounts the default export of a `.tsx` content script into a Shadow DOM. Use Plasmo's `getStyle` export if you need to inject Tailwind CSS into the shadow root — see Plasmo docs for the exact pattern.

**Cross-node selection caveat**: `range.extractContents()` works correctly for selections within a single block element. If the user selects text crossing a block boundary (e.g., two `<p>` tags), the result may be malformed. For MVP, accept this. The 500-character cap already limits most cross-block selections in practice.

---

## Step 7 — Build and Load the Extension

```bash
# Terminal 1: keep dashboard running
cd dashboard && npm run dev

# Terminal 2: build extension in dev mode
cd extension && npm run dev
```

Then load in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select folder: `extension/.plasmo/build/chrome-mv3-dev`
5. The 🐬 icon appears in the Chrome toolbar

---

## Verification Checklist

Complete all items before starting Guide 05.

- [ ] Extension loads in Chrome with no errors shown in `chrome://extensions`.
- [ ] Navigate to any webpage containing Italian text (e.g., it.wikipedia.org). Highlight 3–10 words. The 🐬 button appears below the selection.
- [ ] Click 🐬. A "Analyzing..." loading popup appears briefly. Then the sidebar slides in from the right.
- [ ] The selected text on the page is replaced in-place with colour-coded boxes (blue for nouns, orange for verbs, green for adjectives, etc.).
- [ ] The sidebar shows the DeepL English translation at the top.
- [ ] The sidebar shows the same tokens as a clickable list below the translation.
- [ ] Click a coloured box on the page → that token becomes bold/outlined in the sidebar token list.
- [ ] Click a VERB token (orange box) → a conjugation table appears in the sidebar detail panel.
- [ ] Click ✕ to close the sidebar → coloured boxes are removed and the original page text is restored exactly.
- [ ] Click "Save Word" on any token → button turns green with "Saved ✓" (requires being signed into the dashboard first — see Guide 05).
