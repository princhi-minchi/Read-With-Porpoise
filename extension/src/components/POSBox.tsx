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
