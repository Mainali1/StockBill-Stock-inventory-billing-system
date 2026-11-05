import React, { createContext, useCallback, useContext, useState } from "react";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((msg: string) => addToast(msg, "success"), [addToast]);
  const error = useCallback((msg: string) => addToast(msg, "error"), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div
        className="toast-container"
        style={{
          position: "fixed",
          bottom: "var(--space-6)",
          right: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const isError = t.type === "error";
          return (
            <div
              key={t.id}
              role="status"
              style={{
                pointerEvents: "auto",
                background: "var(--paper-hi)",
                border: `var(--border-thin) solid ${isError ? "var(--red)" : "var(--green)"}`,
                color: isError ? "var(--red)" : "var(--green)",
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                boxShadow: "var(--shadow-frame)",
                maxWidth: "360px",
              }}
            >
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
