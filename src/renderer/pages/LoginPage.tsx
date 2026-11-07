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
        backgroundColor: "#D7C4A5",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          width: "440px",
          backgroundColor: "#F7F2E7",
          border: "1px solid #1C1917",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          padding: "36px 32px 28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ borderBottom: "1px solid #1C1917", paddingBottom: "14px" }}>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "32px",
              fontWeight: 700,
              color: "#1C1917",
              lineHeight: 1.1,
            }}
          >
            StockBill
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#78716C",
              marginTop: "4px",
            }}
          >
            {shopName ? `${shopName} · Stock keeping` : "Stock keeping"}
          </div>
        </div>

        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#1C1917",
              marginBottom: "4px",
              marginTop: 0,
            }}
          >
            Login
          </h1>
          <div style={{ fontSize: "13px", color: "#78716C" }}>
            Open the books with your login.
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              backgroundColor: "#FEE2E2",
              border: "1px solid #EF4444",
              color: "#991B1B",
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
                color: "#1C1917",
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
                border: "1px solid #1C1917",
                backgroundColor: "#FBF9F4",
                fontSize: "14px",
                color: "#1C1917",
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
                color: "#1C1917",
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
                  border: "1px solid #1C1917",
                  borderRight: "none",
                  backgroundColor: "#FBF9F4",
                  fontSize: "14px",
                  color: "#1C1917",
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
                  border: "1px solid #1C1917",
                  backgroundColor: "#EBE4D5",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#1C1917",
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
              backgroundColor: "#82271A",
              color: "#F7F2E7",
              border: "1px solid #1C1917",
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
            fontFamily: "'Courier Prime', monospace",
            fontSize: "11px",
            color: "#78716C",
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
