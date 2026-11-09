import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { ReportsPage } from "./ReportsPage";
import * as api from "../api";
import type { ChannelName, IpcChannels } from "@shared/ipc";

describe("REP-7: ReportsPage component", () => {
  it("REP-7: renders reports page with tabs, range chips, and allows switching", async () => {
    const user = userEvent.setup();

    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C, payload: unknown): Promise<IpcChannels[C]["out"]> => {
      if (channel === "auth:status") {
        const authOut: IpcChannels["auth:status"]["out"] = {
          hasUser: true,
          signedIn: true,
          username: "admin",
          shopName: "Demo Mart",
        };
        return Promise.resolve(authOut as IpcChannels[C]["out"]);
      }
      if (channel === "reports:get") {
        const input = payload as { tab: string; from: string; to: string };
        if (input.tab === "profit") {
          const profitOut: IpcChannels["reports:get"]["out"] = {
            tab: "profit",
            totalSales: 28640000,
            costOfGoods: 21930000,
            grossProfit: 6710000,
            count: 142,
            byDay: [
              { date: "2026-11-01", sales: 70000, profit: 16000, count: 5 },
              { date: "2026-11-02", sales: 95000, profit: 22000, count: 7 },
            ],
            top: [
              { productId: 1, name: "Basmati rice 5kg", sold: 96, sales: 11040000, profit: 1632000 },
            ],
          };
          return Promise.resolve(profitOut as IpcChannels[C]["out"]);
        }
        if (input.tab === "sales") {
          const salesOut: IpcChannels["reports:get"]["out"] = {
            tab: "sales",
            total: 28640000,
            count: 142,
            byDay: [
              { date: "2026-11-01", sales: 70000, profit: 16000, count: 5 },
            ],
            byHour: null,
          };
          return Promise.resolve(salesOut as IpcChannels[C]["out"]);
        }
        if (input.tab === "stock") {
          const stockOut: IpcChannels["reports:get"]["out"] = {
            tab: "stock",
            valuation: 45000000,
            productCount: 12,
            low: [
              { id: 1, name: "Salt 1kg", quantity: 0, reorderLevel: 15, status: "OUT" },
            ],
          };
          return Promise.resolve(stockOut as IpcChannels[C]["out"]);
        }
        if (input.tab === "dues") {
          const duesOut: IpcChannels["reports:get"]["out"] = {
            tab: "dues",
            suppliers: [{ id: 1, name: "Koshi Wholesale", due: 3500000 }],
            totalDue: 3500000,
          };
          return Promise.resolve(duesOut as IpcChannels[C]["out"]);
        }
      }
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <ReportsPage />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByText("Sales and profit for the period you choose")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("COST OF GOODS")).toBeInTheDocument();
      expect(screen.getByText("GROSS PROFIT")).toBeInTheDocument();
    });

    // Switch to Stock tab
    const stockTabBtn = screen.getByRole("button", { name: "Stock" });
    await user.click(stockTabBtn);

    await waitFor(() => {
      expect(screen.getByText("STOCK VALUE")).toBeInTheDocument();
      expect(screen.getByText("Current figures")).toBeInTheDocument();
    });

    // Switch to Supplier dues tab
    const duesTabBtn = screen.getByRole("button", { name: "Supplier dues" });
    await user.click(duesTabBtn);

    await waitFor(() => {
      expect(screen.getByText("TOTAL DUE")).toBeInTheDocument();
      expect(screen.getByText("SUPPLIERS OWED")).toBeInTheDocument();
    });

    // Switch to Sales tab
    const salesTabBtn = screen.getByRole("button", { name: "Sales" });
    await user.click(salesTabBtn);

    await waitFor(() => {
      expect(screen.getByText("TOTAL SALES")).toBeInTheDocument();
    });

    // Click Custom range chip to reveal From and To inputs
    const customChip = screen.getByRole("button", { name: "Custom" });
    await user.click(customChip);

    expect(screen.getByText("From:")).toBeInTheDocument();
    expect(screen.getByText("To:")).toBeInTheDocument();
  });
});
