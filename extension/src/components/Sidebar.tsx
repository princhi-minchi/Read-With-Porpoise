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
    let sessionResponse: { session: { access_token: string } | null } | null = null;
    try {
      sessionResponse = await chrome.runtime.sendMessage({ type: "GET_SESSION" });
    } catch {
      alert("Extension context lost — please reload the page and try again.");
      setSaveStatus((s) => ({ ...s, [token.index]: "idle" }));
      return;
    }
    if (!sessionResponse?.session) {
      setSaveStatus((s) => ({ ...s, [token.index]: "idle" }));
      const result: { error: string | null } = await chrome.runtime.sendMessage({ type: "SIGN_IN_GOOGLE" });
      if (result?.error) {
        alert(`Sign-in failed: ${result.error}`);
      }
      return;
    }
    const res = await fetch(`${API_BASE}/api/words`, {
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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Failed to save word: ${body.error ?? res.status}`);
      setSaveStatus((s) => ({ ...s, [token.index]: "idle" }));
      return;
    }
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
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#1e293b" }}>✕</button>
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
