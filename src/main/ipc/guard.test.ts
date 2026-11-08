import { describe, expect, it, vi } from "vitest";
import type BetterSqlite3 from "better-sqlite3";

const registeredChannels = new Set<string>();

vi.mock("electron", () => ({
  app: { getVersion: () => "0.0.0" },
  ipcMain: {
    handle: vi.fn((channel: string) => {
      if (registeredChannels.has(channel)) {
        throw new Error(`Attempted to register a second handler for '${channel}'`);
      }
      registeredChannels.add(channel);
    }),
  },
}));

import { registerAllHandlers } from "./index";

describe("IPC registration guard", () => {
  it("GUARD: every IPC channel registers exactly once", () => {
    registeredChannels.clear();
    const fakeDb = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ count: 0, value: null }),
        all: vi.fn().mockReturnValue([]),
      }),
    } as unknown as BetterSqlite3.Database;

    expect(() => {
      registerAllHandlers(fakeDb);
    }).not.toThrow();
  });
});
