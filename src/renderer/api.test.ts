import { describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@shared/ipc/common";
import { ApiCallError, call } from "./api";

describe("API", () => {
  it("API: call throws ApiCallError on an error result", async () => {
    window.api = {
      invoke: vi.fn(
        async (): Promise<ApiResult<unknown>> => ({
          ok: false,
          error: {
            code: "VALIDATION",
            message: "Please check the highlighted fields.",
            fields: { name: "Name is required." },
          },
        }),
      ),
    } as unknown as Window["api"];

    await expect(call("auth:status", undefined)).rejects.toBeInstanceOf(ApiCallError);
    await expect(call("auth:status", undefined)).rejects.toMatchObject({
      code: "VALIDATION",
      message: "Please check the highlighted fields.",
      fields: { name: "Name is required." },
    });
  });

  it("API: call returns the data on a success result", async () => {
    window.api = {
      invoke: vi.fn(
        async (): Promise<ApiResult<unknown>> => ({ ok: true, data: { version: "1.2.3" } }),
      ),
    } as unknown as Window["api"];

    await expect(call("app:getVersion", undefined)).resolves.toEqual({ version: "1.2.3" });
  });
});
