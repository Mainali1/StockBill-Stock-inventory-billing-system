import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SalesPage } from "./SalesPage";
import { ToastProvider } from "../components/Toast";
import * as api from "../api";
import type { ChannelName, IpcChannels } from "@shared/ipc";

const mockPickerData = {
  products: [
    {
      id: 1,
      name: "Basmati Rice 5kg",
      code: "RICE5",
      category: "Grocery",
      quantity: 24,
      price: 115000,
    },
    {
      id: 7,
      name: "Salt 1kg",
      code: null,
      category: "Grocery",
      quantity: 0,
      price: 2800,
    },
  ],
  categories: ["Grocery"],
};

function renderSalesPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SalesPage />
      </ToastProvider>
    </MemoryRouter>
  );
}

describe("SalesPage component tests", () => {
  beforeEach(() => {
    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C): Promise<IpcChannels[C]["out"]> => {
      if (channel === "sales:picker") {
        return Promise.resolve(mockPickerData as unknown as IpcChannels[C]["out"]);
      }
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });
  });

  it("SAL-1: Add button disabled at zero stock", async () => {
    renderSalesPage();

    await waitFor(() => {
      expect(screen.getByText("Salt 1kg")).toBeInTheDocument();
    });

    const saltRow = screen.getByText("Salt 1kg").closest("tr");
    expect(saltRow).toBeInTheDocument();
    const addBtn = saltRow?.querySelector("button");
    expect(addBtn).toBeDisabled();
    expect(saltRow).toHaveTextContent("Out");
  });

  it("SAL-1: Now button resets the field", async () => {
    const user = userEvent.setup();
    renderSalesPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/When/i)).toBeInTheDocument();
    });

    const whenInput = screen.getByLabelText(/When/i) as HTMLInputElement;
    await user.clear(whenInput);
    await user.type(whenInput, "2025-01-01T10:00");
    expect(whenInput.value).toBe("2025-01-01T10:00");

    const nowButton = screen.getByRole("button", { name: "Now" });
    await user.click(nowButton);

    expect(whenInput.value).not.toBe("2025-01-01T10:00");
    const currentYear = new Date().getFullYear().toString();
    expect(whenInput.value.startsWith(currentYear)).toBe(true);
  });

  it("SAL-2: shortage message stays visible and lines are kept", async () => {
    const user = userEvent.setup();
    renderSalesPage();

    await waitFor(() => {
      expect(screen.getByText("Basmati Rice 5kg")).toBeInTheDocument();
    });

    const basmatiRow = screen.getByText("Basmati Rice 5kg").closest("tr");
    const addBtn = basmatiRow?.querySelector("button");
    expect(addBtn).toBeDefined();
    await user.click(addBtn!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save sales" })).toBeEnabled();
    });

    const { ApiCallError } = await import("../api");
    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C): Promise<IpcChannels[C]["out"]> => {
      if (channel === "sales:save") {
        return Promise.reject(new ApiCallError("RULE", "Only 24 of Basmati Rice 5kg in stock."));
      }
      if (channel === "sales:picker") {
        return Promise.resolve(mockPickerData as unknown as IpcChannels[C]["out"]);
      }
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });

    const saveBtn = screen.getByRole("button", { name: "Save sales" });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Only 24 of Basmati Rice 5kg in stock.");
    });

    expect(screen.getAllByText("Basmati Rice 5kg").length).toBe(2);
    expect(saveBtn).toBeEnabled();
  });

  it("SAL-3: changing the When field changes the day panel date and totals", async () => {
    const user = userEvent.setup();
    const mockDaySales1 = {
      date: "2026-11-03",
      total: 500000,
      profit: 100000,
      count: 2,
      hourly: new Array(24).fill(0),
      rows: [],
    };
    const mockDaySales2 = {
      date: "2026-11-04",
      total: 900000,
      profit: 250000,
      count: 5,
      hourly: new Array(24).fill(0),
      rows: [],
    };

    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C, payload?: unknown): Promise<IpcChannels[C]["out"]> => {
      if (channel === "sales:day") {
        const p = payload as { date: string };
        if (p.date === "2026-11-03") return Promise.resolve(mockDaySales1 as unknown as IpcChannels[C]["out"]);
        if (p.date === "2026-11-04") return Promise.resolve(mockDaySales2 as unknown as IpcChannels[C]["out"]);
      }
      if (channel === "sales:picker") {
        return Promise.resolve(mockPickerData as unknown as IpcChannels[C]["out"]);
      }
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });

    renderSalesPage();

    const whenInput = screen.getByLabelText(/When/i) as HTMLInputElement;
    await user.clear(whenInput);
    await user.type(whenInput, "2026-11-03T10:00");

    await waitFor(() => {
      expect(screen.getByText(/Sales on Tuesday, 3 November 2026/i)).toBeInTheDocument();
      expect(screen.getByText("Rs. 5,000")).toBeInTheDocument();
    });

    await user.clear(whenInput);
    await user.type(whenInput, "2026-11-04T12:00");

    await waitFor(() => {
      expect(screen.getByText(/Sales on Wednesday, 4 November 2026/i)).toBeInTheDocument();
      expect(screen.getByText("Rs. 9,000")).toBeInTheDocument();
    });
  });

  it("SAL-3: saving a sale updates totals and the hourly chart", async () => {
    const user = userEvent.setup();
    let currentDaySales: IpcChannels["sales:day"]["out"] = {
      date: "2026-11-03",
      total: 0,
      profit: 0,
      count: 0,
      hourly: new Array(24).fill(0),
      rows: [],
    };

    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C, _payload?: unknown): Promise<IpcChannels[C]["out"]> => {
      if (channel === "sales:day") {
        return Promise.resolve(currentDaySales as unknown as IpcChannels[C]["out"]);
      }
      if (channel === "sales:save") {
        const hourly = new Array(24).fill(0);
        hourly[10] = 115000;
        currentDaySales = {
          date: "2026-11-03",
          total: 115000,
          profit: 17000,
          count: 1,
          hourly,
          rows: [
            {
              id: 1,
              soldAt: "2026-11-03 10:00",
              productId: 1,
              productName: "Basmati Rice 5kg",
              quantity: 1,
              unitPrice: 115000,
              unitCost: 98000,
              lineTotal: 115000,
              profit: 17000,
            },
          ],
        };
        return Promise.resolve(currentDaySales as unknown as IpcChannels[C]["out"]);
      }
      if (channel === "sales:picker") {
        return Promise.resolve(mockPickerData as unknown as IpcChannels[C]["out"]);
      }
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });

    renderSalesPage();

    const whenInput = screen.getByLabelText(/When/i) as HTMLInputElement;
    await user.clear(whenInput);
    await user.type(whenInput, "2026-11-03T10:00");

    await waitFor(() => {
      expect(screen.getByText("No sales on this day")).toBeInTheDocument();
    });

    const basmatiRow = screen.getByText("Basmati Rice 5kg").closest("tr");
    const addBtn = basmatiRow?.querySelector("button");
    await user.click(addBtn!);

    const saveBtn = screen.getByRole("button", { name: "Save sales" });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Rs. 1,150")).toBeInTheDocument();
      expect(screen.queryByText("No sales on this day")).not.toBeInTheDocument();
      expect(screen.getByText("10:00")).toBeInTheDocument();
    });
  });
});
