import { describe, expect, it } from "vitest";
import inventoryMock from "./inventory";
import suppliersMock from "./suppliers";
import type { InvoiceInput } from "@shared/ipc/suppliers";
import type { ProductDto } from "@shared/ipc/inventory";

describe("Mock layer: supplier invoice updates inventory", () => {
  it("SUP-3: saving a mock supplier invoice updates mock inventory stock and last cost", () => {
    const listBefore = (inventoryMock["inventory:list"]!({})) as ProductDto[];
    const product1Before = listBefore.find((p) => p.id === 1)!;
    const initialQty = product1Before.quantity;

    const invoicePayload: InvoiceInput = {
      supplierId: 1,
      invoiceNo: "TEST-INV-999",
      invoiceDate: "2026-11-08",
      paidNow: 0,
      items: [
        {
          productId: 1,
          quantity: 10,
          unitCost: 105000,
        },
      ],
    };

    suppliersMock["invoices:create"]!(invoicePayload);

    const listAfter = (inventoryMock["inventory:list"]!({})) as ProductDto[];
    const product1After = listAfter.find((p) => p.id === 1)!;

    expect(product1After.quantity).toBe(initialQty + 10);
    expect(product1After.cost).toBe(105000);
  });
});
