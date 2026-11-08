import React, { useState } from "react";
import { call, ApiCallError } from "../api";

interface SetupPageProps {
  version: string;
  onSuccess: (data: { username: string; shopName: string }) => void;
}

export function SetupPage({ version, onSuccess }: SetupPageProps): JSX.Element {
  const [shopName, setShopName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await call("auth:setup", {
        shopName,
        username,
        password,
        confirmPassword,
      });
      setIsSubmitting(false);
      onSuccess(data);
    } catch (err) {
      setIsSubmitting(false);
      if (err instanceof ApiCallError) {
        setError(err.message);
      } else {
        setError("Setup failed.");
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
            Welcome &middot; Initial setup
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
            Setup
          </h1>
          <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
            Set up your shop name and initial administrator account.
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
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              htmlFor="shopName"
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
              Shop Name
            </label>
            <input
              id="shopName"
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
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

          <div>
            <label
              htmlFor="confirmPassword"
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
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              height: "44px",
              marginTop: "10px",
              backgroundColor: "var(--red)",
              color: "var(--paper-hi)",
              border: "var(--border-thin) solid var(--ink)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Setting up..." : "Complete setup"}
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
