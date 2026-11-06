import React from "react";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  header: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
  emptyTitle?: string;
  emptyHint?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  emptyTitle = "No data",
  emptyHint,
}: DataTableProps<T>): React.JSX.Element {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table
        className="data-table"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--text-sm)",
          textAlign: "left",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "var(--border-thin) solid var(--ink)" }}>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  textAlign: col.align ?? "left",
                  fontSize: "var(--text-xs)",
                  color: "var(--ink-soft)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 600,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const isSelected =
              selectedKey !== undefined && selectedKey !== null && selectedKey === key;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  borderBottom: "var(--border-thin) solid var(--rule)",
                  cursor: onRowClick ? "pointer" : "default",
                  background: isSelected ? "var(--paper-hi)" : "transparent",
                }}
              >
                {columns.map((col, idx) => (
                  <td
                    key={idx}
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      textAlign: col.align ?? "left",
                      fontFamily: col.mono ? "var(--font-mono)" : "inherit",
                    }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
