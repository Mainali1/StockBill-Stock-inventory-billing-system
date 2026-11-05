import React from "react";

export interface PanelProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Panel({ title, children, footer }: PanelProps): React.JSX.Element {
  return (
    <aside
      className="panel"
      style={{
        border: "var(--border-thick) solid var(--ink)",
        background: "var(--paper-hi)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-6)",
        gap: "var(--space-4)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "var(--border-thin) solid var(--rule)",
          paddingBottom: "var(--space-2)",
        }}
      >
        <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>{title}</h2>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {children}
      </div>
      {footer && (
        <div
          style={{
            borderTop: "var(--border-thin) solid var(--rule)",
            paddingTop: "var(--space-3)",
            marginTop: "auto",
          }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}
