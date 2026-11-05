import React from "react";

export type StampKind = "paid" | "due" | "low" | "out" | "in-stock" | "neutral";

export interface StampProps {
  kind: StampKind;
  children?: React.ReactNode;
}

export function getRotation(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.sin(hash);
  return Math.round(normalized * 200) / 100;
}

export function Stamp({ kind, children }: StampProps): React.JSX.Element {
  const defaultLabel = kind === "in-stock" ? "IN STOCK" : kind.toUpperCase();

  const label = typeof children === "string" ? children : defaultLabel;
  const rotation = getRotation(label);

  const isGreen = kind === "paid" || kind === "in-stock";
  const isRed = kind === "due" || kind === "low" || kind === "out";

  const color = isGreen ? "var(--green)" : isRed ? "var(--red)" : "var(--ink-soft)";

  return (
    <span
      className={`stamp stamp--${kind}`}
      style={{
        display: "inline-block",
        border: `var(--border-thin) solid ${color}`,
        color,
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-xs)",
        fontWeight: 700,
        letterSpacing: "0.08em",
        padding: "2px 6px",
        textTransform: "uppercase",
        transform: `rotate(${rotation}deg)`,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children ?? defaultLabel}
    </span>
  );
}
