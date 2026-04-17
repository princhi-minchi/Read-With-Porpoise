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
