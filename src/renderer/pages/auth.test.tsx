import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginPage } from "./LoginPage";
import { SetupPage } from "./SetupPage";
import * as api from "../api";

describe("REL-4: Auth Pages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("REL-4: LoginPage renders shopName, version, and handles sign in", async () => {
    const onSuccess = vi.fn();
    const callSpy = vi.spyOn(api, "call").mockResolvedValue({
      username: "admin",
      shopName: "Demo Mart",
    });

    render(
      <LoginPage
        version="0.0.0"
        shopName="Demo Mart"
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText("Demo Mart · Stock keeping")).toBeInTheDocument();
    expect(screen.getByText("Version 0.0.0")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Login" })).toBeInTheDocument();

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitBtn = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(usernameInput, { target: { value: "admin" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(callSpy).toHaveBeenCalledWith("auth:login", {
        username: "admin",
        password: "password123",
      });
      expect(onSuccess).toHaveBeenCalledWith({
        username: "admin",
        shopName: "Demo Mart",
      });
    });
  });

  it("REL-4: LoginPage toggles password visibility", () => {
    render(
      <LoginPage
        version="0.0.0"
        shopName="Demo Mart"
        onSuccess={vi.fn()}
      />,
    );

    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleBtn = screen.getByRole("button", { name: "Show" });
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(passwordInput.type).toBe("password");
  });

  it("REL-4: SetupPage validates passwords and completes setup", async () => {
    const onSuccess = vi.fn();
    const callSpy = vi.spyOn(api, "call").mockResolvedValue({
      username: "admin",
      shopName: "My Shop",
    });

    render(
      <SetupPage
        version="0.0.0"
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText("Welcome · Initial setup")).toBeInTheDocument();
    expect(screen.getByText("Version 0.0.0")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Setup" })).toBeInTheDocument();

    const shopNameInput = screen.getByLabelText("Shop Name");
    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const confirmInput = screen.getByLabelText("Confirm Password");
    const submitBtn = screen.getByRole("button", { name: "Complete setup" });

    fireEvent.change(shopNameInput, { target: { value: "My Shop" } });
    fireEvent.change(usernameInput, { target: { value: "admin" } });
    fireEvent.change(passwordInput, { target: { value: "short" } });
    fireEvent.change(confirmInput, { target: { value: "short" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
    });

    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.change(confirmInput, { target: { value: "password123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(callSpy).toHaveBeenCalledWith("auth:setup", {
        shopName: "My Shop",
        username: "admin",
        password: "password123",
        confirmPassword: "password123",
      });
      expect(onSuccess).toHaveBeenCalledWith({
        username: "admin",
        shopName: "My Shop",
      });
    });
  });

  it("P1: auth pages only use defined tokens", async () => {
    // In vitest Node/jsdom test runner, dynamically import node:fs and node:path to inspect page sources
    const fs = await import("node:fs");
    const path = await import("node:path");

    const tokensCss = fs.readFileSync(
      path.resolve(__dirname, "../styles/tokens.css"),
      "utf-8",
    );
    const loginSrc = fs.readFileSync(
      path.resolve(__dirname, "./LoginPage.tsx"),
      "utf-8",
    );
    const setupSrc = fs.readFileSync(
      path.resolve(__dirname, "./SetupPage.tsx"),
      "utf-8",
    );

    // Extract all CSS variable definitions from tokens.css: e.g. --red, --paper
    const definedTokens = new Set<string>(
      Array.from(tokensCss.matchAll(/--([a-zA-Z0-9_-]+):/g) as Iterable<RegExpMatchArray>).map(
        (m: RegExpMatchArray) => `--${m[1]}`,
      ),
    );

    for (const [name, src] of [["LoginPage", loginSrc], ["SetupPage", setupSrc]] as const) {
      // Check for hard-coded hex colors
      const hexMatches = src.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
      expect(hexMatches, `${name} must not contain hard-coded hex colors`).toEqual([]);

      // Extract all var(--name) calls
      const varMatches = Array.from(
        src.matchAll(/var\((--[a-zA-Z0-9_-]+)\)/g) as Iterable<RegExpMatchArray>,
      ).map((m: RegExpMatchArray) => m[1]);
      expect(varMatches.length, `${name} should use css variables`).toBeGreaterThan(0);

      const undefinedUsed = varMatches.filter((tok) => Boolean(tok && !definedTokens.has(tok)));
      expect(undefinedUsed, `${name} contains tokens not defined in tokens.css`).toEqual([]);
    }
  });
});
