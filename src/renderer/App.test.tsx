import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@shared/ipc/common";
import { App } from "./App";

interface Status {
  hasUser: boolean;
  signedIn: boolean;
  username: string | null;
  shopName: string | null;
}

function installApi(status: Status): void {
  window.api = {
    invoke: vi.fn(async (channel: string): Promise<ApiResult<unknown>> => {
      if (channel === "app:getVersion") {
        return { ok: true, data: { version: "0.0.0" } };
      }
      if (channel === "auth:status") {
        return { ok: true, data: status };
      }
      return { ok: false, error: { code: "RULE", message: "This feature is not built yet." } };
    }),
  } as unknown as Window["api"];
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("GUARD", () => {
  it("GUARD: redirects to setup, login or dashboard from auth:status", async () => {
    installApi({ hasUser: false, signedIn: false, username: null, shopName: null });
    const setup = renderAt("/");
    expect(await setup.findByRole("heading", { name: "Setup" })).toBeInTheDocument();
    setup.unmount();

    installApi({ hasUser: true, signedIn: false, username: null, shopName: null });
    const login = renderAt("/");
    expect(await login.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    login.unmount();

    installApi({ hasUser: true, signedIn: true, username: "admin", shopName: "Demo Mart" });
    const dashboard = renderAt("/setup");
    expect(await dashboard.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    dashboard.unmount();
  });
});
