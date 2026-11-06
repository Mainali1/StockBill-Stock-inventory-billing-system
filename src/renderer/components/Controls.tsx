import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({
  variant = "secondary",
  children,
  style,
  disabled,
  ...props
}: ButtonProps): React.JSX.Element {
  let background = "transparent";
  let border = "var(--border-thin) solid var(--ink)";
  let color = "var(--ink)";

  if (variant === "primary") {
    background = "var(--red)";
    border = "var(--border-thin) solid var(--red)";
    color = "var(--paper-hi)";
  } else if (variant === "danger") {
    background = "transparent";
    border = "var(--border-thin) solid var(--red)";
    color = "var(--red)";
  }

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "32px",
        padding: "0 var(--space-4)",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        background,
        border,
        color,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Chip({ selected, onClick, children }: ChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "32px",
        padding: "0 var(--space-3)",
        border: "var(--border-thin) solid var(--ink)",
        background: selected ? "var(--ink)" : "var(--paper)",
        color: selected ? "var(--paper-hi)" : "var(--ink)",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        letterSpacing: "0.02em",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, error, hint, children }: FieldProps): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
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
      {children}
      {error && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--red)" }} role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export function TextInput({ mono, style, ...props }: TextInputProps): React.JSX.Element {
  return (
    <input
      {...props}
      style={{
        minHeight: "32px",
        padding: "var(--space-1) var(--space-2)",
        border: "var(--border-thin) solid var(--ink)",
        background: "var(--paper-hi)",
        color: "var(--ink)",
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        fontSize: "var(--text-sm)",
        ...style,
      }}
    />
  );
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ style, children, ...props }: SelectProps): React.JSX.Element {
  return (
    <select
      {...props}
      style={{
        minHeight: "32px",
        padding: "var(--space-1) var(--space-2)",
        border: "var(--border-thin) solid var(--ink)",
        background: "var(--paper-hi)",
        color: "var(--ink)",
        fontSize: "var(--text-sm)",
        ...style,
      }}
    >
      {children}
    </select>
  );
}
