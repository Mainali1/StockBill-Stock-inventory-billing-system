import type BetterSqlite3 from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

import { DomainError } from "../domain/errors";
import { createHandler, type HandlerContext } from "./handle";

const ctx: HandlerContext = {
  db: null as unknown as BetterSqlite3.Database,
  session: null,
};

describe("IPC: createHandler", () => {
  it("IPC: rejects invalid input", async () => {
    const handler = createHandler(
      z.object({ name: z.string().min(1, "Name is required.") }),
      { auth: false },
      () => "ok",
    );

    const result = await handler({ name: "" }, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("VALIDATION");
    expect(result.error.fields).toEqual({ name: "Name is required." });
  });

  it("IPC: rejects a missing session", async () => {
    const handler = createHandler(z.void(), { auth: true }, () => "ok");

    const result = await handler(undefined, ctx);

    expect(result).toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Please sign in." },
    });
  });

  it("IPC: maps DomainError and hides internal errors", async () => {
    const domainHandler = createHandler(
      z.void(),
      { auth: false },
      () => {
        throw new DomainError("RULE", "Nope.");
      },
    );
    const domainResult = await domainHandler(undefined, ctx);
    expect(domainResult).toEqual({ ok: false, error: { code: "RULE", message: "Nope." } });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const internalHandler = createHandler(
      z.void(),
      { auth: false },
      () => {
        throw new Error("boom at SELECT * FROM users");
      },
    );
    const internalResult = await internalHandler(undefined, ctx);

    expect(internalResult).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("IPC: passes a valid payload and session to the feature function", async () => {
    const session = { userId: 1, username: "admin" };
    const handler = createHandler(
      z.object({ value: z.number() }),
      { auth: true },
      (input, context) => `${input.value}:${context.session?.username}`,
    );

    const result = await handler({ value: 7 }, { ...ctx, session });

    expect(result).toEqual({ ok: true, data: "7:admin" });
  });
});
