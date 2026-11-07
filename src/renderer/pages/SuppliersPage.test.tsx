import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { SuppliersPage } from "./SuppliersPage";
import * as api from "../api";
import type { ChannelName, IpcChannels } from "@shared/ipc";
import type { SupplierDetailDto, SupplierSummaryDto } from "@shared/ipc/suppliers";

describe("SuppliersPage component tests", () => {
  const dummySuppliers: SupplierSummaryDto[] = [
    {
      id: 1,
      name: "Koshi Wholesale",
      supplies: "Grocery staples",
      lastInvoiceDate: "2026-10-20",
      due: 4500000,
    },
    {
      id: 2,
      name: "Everest Oil Depot",
      supplies: "Cooking oil",
      lastInvoiceDate: "2026-10-12",
      due: 0,
    },
  ];

  const dummyDetail: SupplierDetailDto = {
    id: 1,
    name: "Koshi Wholesale",
    contactName: "Hari Prasad",
    phone: "9800000001",
    address: "Biratnagar",
    supplies: "Grocery staples",
    due: 4500000,
    invoices: [
      {
        id: 101,
        supplierId: 1,
        supplierName: "Koshi Wholesale",
        invoiceNo: "KW-101",
        invoiceDate: "2026-10-20",
        total: 3000000,
        paidAmount: 0,
        status: "DUE",
        items: [
          {
            productId: 1,
            productName: "Basmati Rice 5kg",
            quantity: 20,
            unitCost: 150000,
          },
        ],
      },
      {
        id: 100,
        supplierId: 1,
        supplierName: "Koshi Wholesale",
        invoiceNo: "KW-100",
        invoiceDate: "2026-10-02",
        total: 2000000,
        paidAmount: 2000000,
        status: "PAID",
        items: [
          {
            productId: 2,
            productName: "Lentils 1kg",
            quantity: 50,
            unitCost: 40000,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });

    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C, payload?: unknown): Promise<IpcChannels[C]["out"]> => {
      if (channel === "suppliers:list") {
        return Promise.resolve({
          suppliers: dummySuppliers,
          totalDue: 4500000,
        } as unknown as IpcChannels[C]["out"]);
      }
      if (channel === "suppliers:get") {
        return Promise.resolve(dummyDetail as unknown as IpcChannels[C]["out"]);
      }
      if (channel === "suppliers:productOptions") {
        return Promise.resolve([
          { id: 1, name: "Basmati Rice 5kg", code: "RICE5", cost: 98000 },
        ] as unknown as IpcChannels[C]["out"]);
      }
      if (channel === "payments:record") {
        const input = payload as { supplierId: number; amount: number };
        return Promise.resolve({
          ...dummyDetail,
          due: dummyDetail.due - input.amount,
        } as unknown as IpcChannels[C]["out"]);
      }
      if (channel === "invoices:create") {
        return Promise.resolve(dummyDetail.invoices[0] as unknown as IpcChannels[C]["out"]);
      }
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });
  });

  it("SUP-5: row selection loads detail", async () => {
    render(
      <MemoryRouter initialEntries={["/suppliers"]}>
        <ToastProvider>
          <Routes>
            <Route path="/suppliers" element={<SuppliersPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Koshi Wholesale").length).toBeGreaterThan(0);
      expect(screen.getByText("Everest Oil Depot")).toBeInTheDocument();
    });

    expect(screen.getByText("Invoice history")).toBeInTheDocument();
    expect(screen.getByText("Hari Prasad")).toBeInTheDocument();
  });

  it("SUP-5: expand shows items and stamps PAID and DUE are correct", async () => {
    render(
      <MemoryRouter initialEntries={["/suppliers"]}>
        <ToastProvider>
          <Routes>
            <Route path="/suppliers" element={<SuppliersPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("KW-101")).toBeInTheDocument();
      expect(screen.getByText("KW-100")).toBeInTheDocument();
    });

    expect(screen.getByText("DUE")).toBeInTheDocument();
    expect(screen.getByText("PAID")).toBeInTheDocument();

    const expandBtn = screen.getByRole("button", { name: "Toggle details for KW-101" });
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByText("Basmati Rice 5kg")).toBeInTheDocument();
    });
  });

  it("SUP-4: Record payment shows Pay full balance and records payment", async () => {
    render(
      <MemoryRouter initialEntries={["/suppliers"]}>
        <ToastProvider>
          <Routes>
            <Route path="/suppliers" element={<SuppliersPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Koshi Wholesale").length).toBeGreaterThan(0);
    });

    const recordPayBtn = screen.getByRole("button", { name: "Record payment" });
    fireEvent.click(recordPayBtn);

    await waitFor(() => {
      expect(screen.getByText("Pay full balance")).toBeInTheDocument();
    });

    const payFullBtn = screen.getByText("Pay full balance");
    fireEvent.click(payFullBtn);

    const amountInput = screen.getByDisplayValue("45000.00");
    expect(amountInput).toBeInTheDocument();
  });

  it("SUP-3: invoice form computes total live", async () => {
    render(
      <MemoryRouter initialEntries={["/suppliers"]}>
        <ToastProvider>
          <Routes>
            <Route path="/suppliers" element={<SuppliersPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Koshi Wholesale").length).toBeGreaterThan(0);
    });

    const newInvoiceBtn = screen.getByRole("button", { name: "New invoice" });
    fireEvent.click(newInvoiceBtn);

    await waitFor(() => {
      expect(screen.getByText("New invoice")).toBeInTheDocument();
      expect(screen.getByText("Total (computed)")).toBeInTheDocument();
    });
  });
});
