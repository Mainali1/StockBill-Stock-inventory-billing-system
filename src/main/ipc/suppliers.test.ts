import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createHandler } from "./handle";
import { openDatabase } from "../db/connection";
import * as suppliersRepo from "../db/repositories/suppliers";

describe("suppliers IPC handlers", () => {
  it("IPC: suppliers:listActive requires authentication", async () => {
    const handler = createHandler(z.void(), { auth: true }, async (_input, ctx) => {
      return suppliersRepo.listActive(ctx.db);
    });

    const db = openDatabase(":memory:");
    const unauthResult = await handler(undefined, { db, session: null });
    expect(unauthResult).toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Please sign in." },
    });

    db.prepare("INSERT INTO suppliers (name, archived) VALUES (?, 0)").run("Koshi Wholesale");

    const authResult = await handler(undefined, {
      db,
      session: { userId: 1, username: "admin" },
    });
    expect(authResult.ok).toBe(true);
    if (authResult.ok) {
      expect(authResult.data).toEqual([{ id: 1, name: "Koshi Wholesale" }]);
    }
  });
});
