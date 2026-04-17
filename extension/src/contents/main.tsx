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
      if (text.length > 500) return;
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

    const language = "IT";

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
