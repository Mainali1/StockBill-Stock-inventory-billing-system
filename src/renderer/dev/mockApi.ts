import type { ApiResult } from "@shared/ipc/common";

export type MockHandler = (payload: unknown) => unknown | Promise<unknown>;
export type MockModule = Record<string, MockHandler>;

type MockState = "setup" | "login" | "signedin";

const NOT_BUILT: ApiResult<never> = {
  ok: false,
  error: { code: "RULE", message: "This feature is not built yet." },
};

function currentState(): MockState {
  if (typeof window === "undefined") {
    return "signedin";
  }
  const value = new URLSearchParams(window.location.search).get("state");
  if (value === "setup" || value === "login" || value === "signedin") {
    return value;
  }
  return "signedin";
}

function statusFor(state: MockState) {
  if (state === "setup") {
    return { hasUser: false, signedIn: false, username: null, shopName: null };
  }
  if (state === "login") {
    return { hasUser: true, signedIn: false, username: null, shopName: "Demo Mart" };
  }
  return { hasUser: true, signedIn: true, username: "admin", shopName: "Demo Mart" };
}

function builtInHandlers(): MockModule {
  return {
    "app:getVersion": () => ({ version: "0.0.0" }),
    "auth:status": () => statusFor(currentState()),
  };
}

/** Later phases drop a file in `src/renderer/dev/mock/` that default-exports handlers. */
const mockModules = import.meta.glob<{ default: MockModule }>(["./mock/*.ts", "!./mock/*.test.ts"], {
  eager: true,
});

function collectHandlers(): MockModule {
  const handlers: MockModule = builtInHandlers();
  for (const module of Object.values(mockModules)) {
    Object.assign(handlers, module.default ?? {});
  }
  return handlers;
}

async function mockInvoke(channel: string, payload: unknown): Promise<ApiResult<unknown>> {
  const handler = collectHandlers()[channel];
  if (handler === undefined) {
    return NOT_BUILT;
  }
  try {
    const data = await handler(payload);
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
    };
  }
}

/**
 * Installs an in-memory stand-in for `window.api` when the app runs in a plain
 * browser (`npm run dev:web`). It answers the version and auth status and
 * reports every other channel as not built yet.
 */
export function installMockApi(): void {
  if (typeof window === "undefined" || window.api) {
    return;
  }
  window.api = { invoke: mockInvoke } as unknown as Window["api"];
}
