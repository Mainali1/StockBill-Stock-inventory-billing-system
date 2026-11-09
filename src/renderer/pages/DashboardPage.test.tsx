import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "./DashboardPage";
import * as api from "../api";
import type { ChannelName, IpcChannels } from "@shared/ipc";
import type { DashboardDto } from "@shared/ipc/reports";

const mockDashboardData: DashboardDto = {
  date: "2026-11-03",
  isToday: true,
  sales: 4825000,
  profit: 912000,
  lowStockCount: 4,
  supplierDue: 12000000,
  week: [
    { date: "2026-11-01", label: "Sun", sales: 100000, profit: 20000 },
    { date: "2026-11-02", label: "Mon", sales: 200000, profit: 40000 },
    { date: "2026-11-03", label: "Tue", sales: 4825000, profit: 912000 },
    { date: "2026-11-04", label: "Wed", sales: 150000, profit: 30000 },
    { date: "2026-11-05", label: "Thu", sales: 300000, profit: 60000 },
    { date: "2026-11-06", label: "Fri", sales: 250000, profit: 50000 },
    { date: "2026-11-07", label: "Sat", sales: 400000, profit: 80000 },
  ],
  restock: [
    { productId: 7, name: "Salt 1kg", quantity: 0 },
    { productId: 5, name: "Tea 250g", quantity: 2 },
    { productId: 4, name: "Sunflower Oil 1L", quantity: 4 },
    { productId: 8, name: "Notebook A4", quantity: 5 },
  ],
  recentInvoices: [
    {
      id: 6,
      supplierId: 1,
      invoiceNo: "KW-2026-019",
      supplierName: "Koshi Wholesale",
      total: 1568000,
      status: "DUE",
    },
    {
      id: 5,
      supplierId: 5,
      invoiceNo: "MH-118",
      supplierName: "Mechi Household Supplies",
      total: 470000,
      status: "PAID",
    },
  ],
};

function renderDashboardPage(initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe("DashboardPage component tests", () => {
  beforeEach(() => {
    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C): Promise<IpcChannels[C]["out"]> => {
      if (channel === "dashboard:get") {
        return Promise.resolve(mockDashboardData as unknown as IpcChannels[C]["out"]);
      }
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });
  });

  it("DASH-5: New sale button links to /sales", async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    });

    const newSaleBtn = screen.getByRole("link", { name: /new sale/i });
    expect(newSaleBtn).toBeInTheDocument();
    expect(newSaleBtn).toHaveAttribute("href", "/sales");
  });

  it("DASH-1: renders stat cards with today's labels, formatted currency and tone", async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("TODAY'S SALES")).toBeInTheDocument();
    });

    expect(screen.getByText("TODAY'S PROFIT")).toBeInTheDocument();
    expect(screen.getByText("LOW-STOCK ITEMS")).toBeInTheDocument();
    expect(screen.getByText("SUPPLIER DUES")).toBeInTheDocument();

    expect(screen.getByText("Rs. 48,250")).toBeInTheDocument();
    expect(screen.getByText("Rs. 9,120")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Rs. 1,20,000")).toBeInTheDocument();
  });

  it("DASH-2: renders week bars chart with selected date bold", async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("Sales this week")).toBeInTheDocument();
    });

    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    const tueLabel = screen.getByText("Tue");
    expect(tueLabel).toBeInTheDocument();
    expect(tueLabel).toHaveStyle({ fontWeight: "700" });
  });

  it("DASH-3: restock list links to /inventory?product={id}", async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("Needs restock")).toBeInTheDocument();
    });

    expect(screen.getByText("Salt 1kg")).toBeInTheDocument();
    expect(screen.getByText("0 left")).toBeInTheDocument();
    expect(screen.getByText("Tea 250g")).toBeInTheDocument();
    expect(screen.getByText("2 left")).toBeInTheDocument();

    const saltLink = screen.getByRole("link", { name: /salt 1kg/i });
    expect(saltLink).toHaveAttribute("href", "/inventory?product=7");
  });

  it("DASH-4: recent invoices table links to /suppliers?supplier={supplierId} with stamps", async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("Recent supplier invoices")).toBeInTheDocument();
    });

    expect(screen.getByText("KW-2026-019")).toBeInTheDocument();
    expect(screen.getByText("Koshi Wholesale")).toBeInTheDocument();
    expect(screen.getByText("15,680.00")).toBeInTheDocument();
    expect(screen.getByText("DUE")).toBeInTheDocument();

    expect(screen.getByText("MH-118")).toBeInTheDocument();
    expect(screen.getByText("Mechi Household Supplies")).toBeInTheDocument();
    expect(screen.getByText("4,700.00")).toBeInTheDocument();
    expect(screen.getByText("PAID")).toBeInTheDocument();

    const invoiceRowLink = screen.getByRole("link", { name: /KW-2026-019/i });
    expect(invoiceRowLink).toHaveAttribute("href", "/suppliers?supplier=1");
  });

  it("DASH-1: renders non-today card labels and negative profit tone", async () => {
    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C): Promise<IpcChannels[C]["out"]> => {
      if (channel === "dashboard:get") {
        return Promise.resolve({
          ...mockDashboardData,
          date: "2026-10-20",
          isToday: false,
          profit: -5000,
          restock: [],
          recentInvoices: [],
        } as unknown as IpcChannels[C]["out"]);
      }
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText(/SALES ON 20 OCT/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/PROFIT ON 20 OCT/i)).toBeInTheDocument();
    expect(screen.getByText("Nothing needs restocking")).toBeInTheDocument();
    expect(screen.getByText("No supplier invoices yet")).toBeInTheDocument();
  });

  it("DASH-5: changing the date input reloads dashboard data", async () => {
    const callSpy = vi.spyOn(api, "call");

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Dashboard date")).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText("Dashboard date");
    fireEvent.change(dateInput, { target: { value: "2026-10-15" } });

    await waitFor(() => {
      expect(callSpy).toHaveBeenCalledWith("dashboard:get", { date: "2026-10-15" });
    });
  });

  it("DASH-5: renders error state and retries on button click", async () => {
    const user = userEvent.setup();
    let shouldFail = true;

    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C): Promise<IpcChannels[C]["out"]> => {
      if (channel === "dashboard:get") {
        if (shouldFail) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve(mockDashboardData as unknown as IpcChannels[C]["out"]);
      }
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("Failed to load dashboard data. Please try again.")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    shouldFail = false;
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("TODAY'S SALES")).toBeInTheDocument();
    });
  });
});
