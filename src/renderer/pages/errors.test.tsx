import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { ApiCallError } from "../api";
import * as api from "../api";
import { DashboardPage } from "./DashboardPage";
import { ReportsPage } from "./ReportsPage";
import { SalesPage } from "./SalesPage";
import type { ChannelName, IpcChannels } from "@shared/ipc";

/**
 * Polish: a failed load shows the real error message, and never retries in a loop.
 * These tests are named POLISH because they cover behavior across several screens.
 */

function renderPage(page: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{page}</ToastProvider>
    </MemoryRouter>,
  );
}

function failWith(message: string, calls: string[]) {
  return vi
    .spyOn(api, "call")
    .mockImplementation(<C extends ChannelName>(channel: C): Promise<IpcChannels[C]["out"]> => {
      calls.push(channel);
      if (channel === "auth:status") {
        const status: IpcChannels["auth:status"]["out"] = {
          hasUser: true,
          signedIn: true,
          username: "admin",
          shopName: "Demo Mart",
        };
        return Promise.resolve(status as IpcChannels[C]["out"]);
      }
      return Promise.reject(new ApiCallError("INTERNAL", message));
    });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POLISH: failed loads", () => {
  it("POLISH: Dashboard shows the message from the main process", async () => {
    failWith("The database file is locked.", []);
    renderPage(<DashboardPage />);
    expect(await screen.findByText("The database file is locked.")).toBeInTheDocument();
  });

  it("POLISH: Reports shows the error once and does not retry in a loop", async () => {
    const calls: string[] = [];
    failWith("Report storage is unavailable.", calls);
    renderPage(<ReportsPage />);
    expect((await screen.findAllByText("Report storage is unavailable.")).length).toBeGreaterThan(
      0,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(calls.filter((c) => c === "reports:get")).toHaveLength(1);
  });

  it("POLISH: Sales toasts a failed load once and does not retry in a loop", async () => {
    const calls: string[] = [];
    failWith("Could not read products.", calls);
    renderPage(<SalesPage />);
    expect((await screen.findAllByText("Could not read products.")).length).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 600));
    // The picker loads once on mount and once more after the 200 ms search debounce, no more.
    expect(calls.filter((c) => c === "sales:picker").length).toBeLessThanOrEqual(3);
    expect(calls.filter((c) => c === "sales:day")).toHaveLength(1);
  });
});
