import React from "react";

export interface StatCardProps {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "bad";
}

export function StatCard({ label, value, tone = "default" }: StatCardProps): React.JSX.Element {
  const valueColor =
    tone === "good" ? "var(--green)" : tone === "bad" ? "var(--red)" : "var(--ink)";

  return (
    <div
      className={`stat-card stat-card--${tone}`}
      style={{
        background: "var(--paper-hi)",
        border: "var(--border-thin) dashed var(--ink)",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--ink-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xl)",
          fontWeight: 700,
          color: valueColor,
        }}
      >
        {value}
      </span>
    </div>
  );
}
