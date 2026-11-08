import React, { useState, useEffect } from "react";
import { call, ApiCallError } from "../api";

interface LoginPageProps {
  version: string;
  shopName: string;
  onSuccess: (data: { username: string; shopName: string }) => void;
}

export function LoginPage({ version, shopName, onSuccess }: LoginPageProps): JSX.Element {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (lockoutRemaining === null || lockoutRemaining <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining && lockoutRemaining > 0) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const data = await call("auth:login", { username, password });
      setIsSubmitting(false);
      onSuccess(data);
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof ApiCallError ? err.message : "Invalid username or password.";
      setError(msg);

      const match = msg.match(/Locked out for (\d+) seconds/i);
      if (match && match[1]) {
        setLockoutRemaining(parseInt(match[1], 10));
      }
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "var(--bg-edge)",
        backgroundImage: "radial-gradient(ellipse at 50% 40%, var(--paper-hi), var(--bg-edge) 100%)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        style={{
          width: "440px",
          backgroundColor: "var(--paper)",
          border: "var(--border-thin) solid var(--ink)",
          boxShadow: "var(--shadow-frame)",
          padding: "36px 32px 28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ borderBottom: "var(--border-thin) solid var(--ink)", paddingBottom: "14px" }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.1,
            }}
          >
            StockBill
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "var(--ink-soft)",
              marginTop: "4px",
            }}
          >
            {shopName ? `${shopName} · Stock keeping` : "Stock keeping"}
          </div>
        </div>

        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--ink)",
              marginBottom: "4px",
              marginTop: 0,
            }}
          >
            Login
          </h1>
          <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
            Open the books with your login.
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              backgroundColor: "var(--paper-hi)",
              border: "var(--border-thin) solid var(--red)",
              color: "var(--red)",
              fontSize: "13px",
              borderRadius: "2px",
            }}
          >
            {lockoutRemaining && lockoutRemaining > 0
              ? `Too many failed attempts. Locked out for ${lockoutRemaining} seconds.`
              : error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              htmlFor="username"
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--ink)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "6px",
              }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={lockoutRemaining !== null && lockoutRemaining > 0}
              required
              style={{
                width: "100%",
                height: "38px",
                padding: "8px 12px",
                border: "var(--border-thin) solid var(--ink)",
                backgroundColor: "var(--paper-hi)",
                fontSize: "14px",
                color: "var(--ink)",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--ink)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <div style={{ display: "flex", width: "100%" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={lockoutRemaining !== null && lockoutRemaining > 0}
                required
                style={{
                  flex: 1,
                  height: "38px",
                  padding: "8px 12px",
                  border: "var(--border-thin) solid var(--ink)",
                  borderRight: "none",
                  backgroundColor: "var(--paper-hi)",
                  fontSize: "14px",
                  color: "var(--ink)",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={lockoutRemaining !== null && lockoutRemaining > 0}
                style={{
                  height: "38px",
                  padding: "0 14px",
                  border: "var(--border-thin) solid var(--ink)",
                  backgroundColor: "var(--paper)",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || (lockoutRemaining !== null && lockoutRemaining > 0)}
            style={{
              height: "44px",
              marginTop: "10px",
              backgroundColor: "var(--red)",
              color: "var(--paper-hi)",
              border: "var(--border-thin) solid var(--ink)",
              fontSize: "14px",
              fontWeight: 600,
              cursor:
                isSubmitting || (lockoutRemaining !== null && lockoutRemaining > 0)
                  ? "not-allowed"
                  : "pointer",
              opacity: lockoutRemaining !== null && lockoutRemaining > 0 ? 0.6 : 1,
            }}
          >
            {isSubmitting
              ? "Signing in..."
              : lockoutRemaining !== null && lockoutRemaining > 0
                ? `Locked (${lockoutRemaining}s)`
                : "Sign in"}
          </button>
        </form>

        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--ink-soft)",
            textAlign: "right",
            marginTop: "10px",
          }}
        >
          Version {version}
        </div>
      </div>
    </div>
  );
}
