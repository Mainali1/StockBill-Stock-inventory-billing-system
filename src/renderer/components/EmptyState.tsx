import React from "react";

export interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className="empty-state"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-8)",
        textAlign: "center",
        color: "var(--ink-soft)",
      }}
    >
      <p style={{ fontWeight: 600, fontSize: "var(--text-base)", margin: 0, color: "var(--ink)" }}>
        {title}
      </p>
      {hint && (
        <p
          style={{
            fontSize: "var(--text-sm)",
            margin: "var(--space-1) 0 0",
            color: "var(--ink-soft)",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export function Loading(): React.JSX.Element {
  return (
    <div
      className="loading-indicator"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-8)",
        color: "var(--ink-soft)",
        fontSize: "var(--text-sm)",
      }}
    >
      <span>Loading...</span>
    </div>
  );
}
