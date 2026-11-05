import React, { useEffect, useRef } from "react";
import { Button } from "./Controls";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onCancel]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      style={{
        border: "var(--border-thick) solid var(--ink)",
        background: "var(--paper-hi)",
        padding: "var(--space-6)",
        maxWidth: "400px",
        width: "100%",
        boxShadow: "var(--shadow-frame)",
      }}
    >
      <h3 style={{ fontSize: "var(--text-lg)", margin: "0 0 var(--space-2)" }}>{title}</h3>
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--ink-soft)",
          margin: "0 0 var(--space-6)",
        }}
      >
        {message}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          onClick={() => {
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
