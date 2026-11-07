import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { InventoryPage } from "./InventoryPage";
import * as api from "../api";
import type { ProductDto } from "@shared/ipc/inventory";
import type { ChannelName, IpcChannels } from "@shared/ipc";

describe("InventoryPage component tests", () => {
  const dummyProducts: ProductDto[] = [
    {
      id: 1,
      name: "Basmati rice 5kg",
      code: "RICE5",
      category: "Grocery",
      supplierId: 1,
      supplierName: "Koshi Wholesale",
      cost: 98000,
      price: 115000,
      quantity: 24,
      reorderLevel: 10,
      status: "IN_STOCK",
    },
    {
      id: 2,
      name: "Salt 1kg",
      code: "SALT1",
      category: "Grocery",
      supplierId: null,
      supplierName: null,
      cost: 2200,
      price: 2800,
      quantity: 0,
      reorderLevel: 15,
      status: "OUT",
    },
  ];

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });

    vi.spyOn(api, "call").mockImplementation(<C extends ChannelName>(channel: C): Promise<IpcChannels[C]["out"]> => {
      if (channel === "inventory:list") return Promise.resolve(dummyProducts as unknown as IpcChannels[C]["out"]);
      if (channel === "inventory:categories") return Promise.resolve(["Grocery"] as unknown as IpcChannels[C]["out"]);
      if (channel === "suppliers:listActive") return Promise.resolve([{ id: 1, name: "Koshi Wholesale" }] as unknown as IpcChannels[C]["out"]);
      if (channel === "auth:status")
        return Promise.resolve({
          hasUser: true,
          signedIn: true,
          username: "admin",
          shopName: "Demo Mart",
        } as unknown as IpcChannels[C]["out"]);
      return Promise.resolve(undefined as unknown as IpcChannels[C]["out"]);
    });
  });

  it("INV-5: renders product list and shows appropriate stamps", async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <InventoryPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Basmati rice 5kg")).toBeInTheDocument();
      expect(screen.getByText("Salt 1kg")).toBeInTheDocument();
    });

    expect(screen.getByText("IN STOCK")).toBeInTheDocument();
    expect(screen.getByText("OUT")).toBeInTheDocument();
  });

  it("INV-5: selecting a row populates the edit form", async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <InventoryPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Basmati rice 5kg")).toBeInTheDocument();
    });

    const editBtns = screen.getAllByRole("button", { name: "Edit" });
    const firstEditBtn = editBtns[0];
    expect(firstEditBtn).toBeDefined();
    fireEvent.click(firstEditBtn!);

    expect(screen.getByDisplayValue("Basmati rice 5kg")).toBeInTheDocument();
    expect(screen.getByDisplayValue("RICE5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("980.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1150.00")).toBeInTheDocument();
  });

  it("INV-5: row selection fills the form, dirty-switch asks for confirmation, and ?product= preselects", async () => {
    render(
      <MemoryRouter initialEntries={["/inventory?product=2"]}>
        <ToastProvider>
          <Routes>
            <Route path="/inventory" element={<InventoryPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Salt 1kg")).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue("Salt 1kg");
    fireEvent.change(nameInput, { target: { value: "Dirty Salt" } });

    // Select row 1
    const editBtns = screen.getAllByRole("button", { name: "Edit" });
    const firstEditBtn = editBtns[0];
    expect(firstEditBtn).toBeDefined();
    fireEvent.click(firstEditBtn!);

    // Confirmation dialog should appear
    expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
    expect(
      screen.getByText("You have unsaved changes in this form. If you continue, your changes will be lost.")
    ).toBeInTheDocument();

    const discardBtn = screen.getByRole("button", { name: "Discard changes" });
    fireEvent.click(discardBtn);

    // Form switches to row 1
    await waitFor(() => {
      expect(screen.getByDisplayValue("Basmati rice 5kg")).toBeInTheDocument();
    });
  });

  it("INV-5: Delete asks for confirmation with ConfirmDialog", async () => {
    render(
      <MemoryRouter initialEntries={["/inventory?product=1"]}>
        <ToastProvider>
          <Routes>
            <Route path="/inventory" element={<InventoryPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Basmati rice 5kg")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Delete product")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to delete Basmati rice 5kg?")).toBeInTheDocument();
  });
});
