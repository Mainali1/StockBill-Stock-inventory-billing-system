import { describe, expect, it } from "vitest";
import { CHANNELS } from "./channels";

describe("CONTRACT: channel list", () => {
  it("CONTRACT: CHANNELS lists every channel", () => {
    // No duplicates: the list is used to register fallbacks, so a repeat would
    // mean a channel is registered twice.
    expect(new Set(CHANNELS).size).toBe(CHANNELS.length);

    // Every contract channel is present. The matching compile-time assertion in
    // channels.ts fails the typecheck if a channel is ever missing here.
    expect(CHANNELS).toEqual(
      expect.arrayContaining([
        "app:getVersion",
        "auth:status",
        "auth:setup",
        "auth:login",
        "auth:logout",
        "inventory:list",
        "sales:save",
        "suppliers:list",
        "payments:record",
        "reports:exportCsv",
      ]),
    );
  });
});
