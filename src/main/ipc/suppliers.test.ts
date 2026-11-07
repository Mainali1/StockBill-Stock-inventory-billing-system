import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createHandler } from "./handle";
import { openDatabase } from "../db/connection";
import * as suppliersRepo from "../db/repositories/suppliers";

describe("suppliers IPC handlers", () => {
  it("IPC: suppliers:listActive requires authentication", async () => {
    const handler = createHandler(z.void(), { auth: true }, async (_input, ctx) => {
      return suppliersRepo.listActive(ctx.db);
    });

    const db = openDatabase(":memory:");
    const unauthResult = await handler(undefined, { db, session: null });
    expect(unauthResult).toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Please sign in." },
    });

    db.prepare("INSERT INTO suppliers (name, archived) VALUES (?, 0)").run("Koshi Wholesale");

    const authResult = await handler(undefined, {
      db,
      session: { userId: 1, username: "admin" },
    });
    expect(authResult.ok).toBe(true);
    if (authResult.ok) {
      expect(authResult.data).toEqual([{ id: 1, name: "Koshi Wholesale" }]);
    }
  });
});

import * as suppliersAdminRepo from "../db/repositories/suppliersAdmin";

describe("SUP-1 requirement tests", () => {
  it("SUP-1: creates and edits a supplier; duplicate name is rejected", () => {
    const db = openDatabase(":memory:");
    const s1 = suppliersAdminRepo.saveSupplier(db, {
      name: "Koshi Wholesale",
      contactName: "Hari",
      phone: "9800000001",
      address: "Biratnagar",
      supplies: "Grocery staples",
    });

    expect(s1.id).toBeDefined();
    expect(s1.name).toBe("Koshi Wholesale");
    expect(s1.contactName).toBe("Hari");

    const s1Edited = suppliersAdminRepo.saveSupplier(db, {
      id: s1.id,
      name: "Koshi Wholesale Ltd",
      contactName: "Hari Prasad",
      phone: "9800000001",
      address: "Biratnagar",
      supplies: "Grocery staples",
    });
    expect(s1Edited.id).toBe(s1.id);
    expect(s1Edited.name).toBe("Koshi Wholesale Ltd");

    expect(() => {
      suppliersAdminRepo.saveSupplier(db, {
        name: "Koshi Wholesale Ltd",
        contactName: "Other",
        phone: null,
        address: null,
        supplies: null,
      });
    }).toThrow();
  });

  it("SUP-1: supplier with invoices is archived, not deleted", () => {
    const db = openDatabase(":memory:");
    const s1 = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier with Invoices",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO supplier_invoices (supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (?, 'INV-101', '2026-10-01', 50000, 50000, '2026-10-01 10:00')
    `).run(s1.id);

    const res = suppliersAdminRepo.deleteSupplier(db, s1.id);
    expect(res).toEqual({ result: "archived" });

    const row = db.prepare("SELECT archived FROM suppliers WHERE id = ?").get(s1.id) as { archived: number };
    expect(row.archived).toBe(1);
  });

  it("SUP-1: supplier with no history is deleted", () => {
    const db = openDatabase(":memory:");
    const s1 = suppliersAdminRepo.saveSupplier(db, {
      name: "Clean Supplier",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    const res = suppliersAdminRepo.deleteSupplier(db, s1.id);
    expect(res).toEqual({ result: "deleted" });

    const row = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(s1.id);
    expect(row).toBeUndefined();
  });
});

describe("SUP-2 requirement tests", () => {
  it("SUP-2: due is the sum of total minus paid across invoices", () => {
    const db = openDatabase(":memory:");
    const s = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier Due Test",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO supplier_invoices (supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (?, 'INV-1', '2026-10-01', 50000, 20000, '2026-10-01 10:00'),
             (?, 'INV-2', '2026-10-05', 30000, 10000, '2026-10-05 10:00')
    `).run(s.id, s.id);

    const res = suppliersAdminRepo.listSuppliers(db, {});
    const item = res.suppliers.find((x) => x.id === s.id);
    expect(item).toBeDefined();
    expect(item?.due).toBe(50000);
  });

  it("SUP-2: last invoice date is the latest invoice date", () => {
    const db = openDatabase(":memory:");
    const s = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier Date Test",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO supplier_invoices (supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (?, 'INV-1', '2026-10-01', 10000, 10000, '2026-10-01 10:00'),
             (?, 'INV-2', '2026-10-15', 20000, 20000, '2026-10-15 10:00'),
             (?, 'INV-3', '2026-10-08', 30000, 30000, '2026-10-08 10:00')
    `).run(s.id, s.id, s.id);

    const res = suppliersAdminRepo.listSuppliers(db, {});
    const item = res.suppliers.find((x) => x.id === s.id);
    expect(item?.lastInvoiceDate).toBe("2026-10-15");
  });

  it("SUP-2: search matches supplier name and supplies; % and _ are literal", () => {
    const db = openDatabase(":memory:");
    suppliersAdminRepo.saveSupplier(db, {
      name: "Special 100% Cotton Supplier",
      contactName: null,
      phone: null,
      address: null,
      supplies: "Fabrics & thread",
    });
    suppliersAdminRepo.saveSupplier(db, {
      name: "Oil Depot",
      contactName: null,
      phone: null,
      address: null,
      supplies: "Cooking oil_100",
    });

    const percentMatch = suppliersAdminRepo.listSuppliers(db, { search: "100%" });
    expect(percentMatch.suppliers).toHaveLength(1);
    expect(percentMatch.suppliers[0]?.name).toBe("Special 100% Cotton Supplier");

    const underscoreMatch = suppliersAdminRepo.listSuppliers(db, { search: "oil_" });
    expect(underscoreMatch.suppliers).toHaveLength(1);
    expect(underscoreMatch.suppliers[0]?.name).toBe("Oil Depot");

    const suppliesMatch = suppliersAdminRepo.listSuppliers(db, { search: "thread" });
    expect(suppliesMatch.suppliers).toHaveLength(1);
    expect(suppliesMatch.suppliers[0]?.name).toBe("Special 100% Cotton Supplier");
  });

  it("SUP-2: total due equals the sum of the listed suppliers", () => {
    const db = openDatabase(":memory:");
    const s1 = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier A",
      contactName: null,
      phone: null,
      address: null,
      supplies: "Items A",
    });
    const s2 = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier B",
      contactName: null,
      phone: null,
      address: null,
      supplies: "Items B",
    });

    db.prepare(`
      INSERT INTO supplier_invoices (supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (?, 'INV-A', '2026-10-01', 40000, 10000, '2026-10-01 10:00'),
             (?, 'INV-B', '2026-10-02', 25000, 5000, '2026-10-02 10:00')
    `).run(s1.id, s2.id);

    const all = suppliersAdminRepo.listSuppliers(db, {});
    expect(all.suppliers).toHaveLength(2);
    expect(all.totalDue).toBe(50000);

    const filtered = suppliersAdminRepo.listSuppliers(db, { search: "Supplier A" });
    expect(filtered.suppliers).toHaveLength(1);
    expect(filtered.totalDue).toBe(30000);
  });
});

import * as supplierInvoicesRepo from "../db/repositories/supplierInvoices";

describe("SUP-3 requirement tests", () => {
  it("SUP-3: saves invoice, adds stock, sets cost to the invoice unit cost", () => {
    const db = openDatabase(":memory:");
    const supp = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier Stock Test",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Test Product', 'TP1', 'Category', 1000, 1500, 10, 5, 0)
    `).run();
    const prod = db.prepare("SELECT * FROM products WHERE code = 'TP1'").get() as { id: number; quantity: number; cost: number };

    const inv = supplierInvoicesRepo.createInvoice(db, {
      supplierId: supp.id,
      invoiceNo: "INV-100",
      invoiceDate: "2026-10-10",
      items: [{ productId: prod.id, quantity: 15, unitCost: 1200 }],
      paidNow: 5000,
    });

    expect(inv.id).toBeDefined();
    expect(inv.total).toBe(18000);
    expect(inv.paidAmount).toBe(5000);
    expect(inv.status).toBe("DUE");

    const updatedProd = db.prepare("SELECT * FROM products WHERE id = ?").get(prod.id) as { quantity: number; cost: number };
    expect(updatedProd.quantity).toBe(25);
    expect(updatedProd.cost).toBe(1200);
  });

  it("SUP-3: total is computed on the server and ignores a client total", () => {
    const db = openDatabase(":memory:");
    const supp = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier Total Test",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Product A', 'PA', 'Cat', 100, 200, 5, 2, 0),
             ('Product B', 'PB', 'Cat', 200, 300, 5, 2, 0)
    `).run();
    const p1 = db.prepare("SELECT id FROM products WHERE code = 'PA'").get() as { id: number };
    const p2 = db.prepare("SELECT id FROM products WHERE code = 'PB'").get() as { id: number };

    const inv = supplierInvoicesRepo.createInvoice(db, {
      supplierId: supp.id,
      invoiceNo: "INV-200",
      invoiceDate: "2026-10-11",
      items: [
        { productId: p1.id, quantity: 2, unitCost: 500 },
        { productId: p2.id, quantity: 3, unitCost: 400 },
      ],
      paidNow: 2200,
    });

    expect(inv.total).toBe(2200);
    expect(inv.status).toBe("PAID");
  });

  it("SUP-3: duplicate invoice number for the same supplier is rejected; same number for another supplier is accepted", () => {
    const db = openDatabase(":memory:");
    const supp1 = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier 1",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });
    const supp2 = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier 2",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Product 1', 'P1', 'Cat', 100, 200, 5, 2, 0)
    `).run();
    const prod = db.prepare("SELECT id FROM products WHERE code = 'P1'").get() as { id: number };

    supplierInvoicesRepo.createInvoice(db, {
      supplierId: supp1.id,
      invoiceNo: "SAME-NUM",
      invoiceDate: "2026-10-12",
      items: [{ productId: prod.id, quantity: 1, unitCost: 100 }],
      paidNow: 100,
    });

    expect(() => {
      supplierInvoicesRepo.createInvoice(db, {
        supplierId: supp1.id,
        invoiceNo: "SAME-NUM",
        invoiceDate: "2026-10-13",
        items: [{ productId: prod.id, quantity: 1, unitCost: 100 }],
        paidNow: 100,
      });
    }).toThrow("This supplier already has an invoice with that number.");

    const inv2 = supplierInvoicesRepo.createInvoice(db, {
      supplierId: supp2.id,
      invoiceNo: "SAME-NUM",
      invoiceDate: "2026-10-13",
      items: [{ productId: prod.id, quantity: 1, unitCost: 100 }],
      paidNow: 100,
    });
    expect(inv2.id).toBeDefined();
  });

  it("SUP-3: duplicate product lines, zero quantity, empty items and overpaying are rejected with exact messages", () => {
    const db = openDatabase(":memory:");
    const supp = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier Val Test",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Product Val', 'PV', 'Cat', 100, 200, 5, 2, 0)
    `).run();
    const prod = db.prepare("SELECT id FROM products WHERE code = 'PV'").get() as { id: number };

    expect(() => {
      supplierInvoicesRepo.createInvoice(db, {
        supplierId: supp.id,
        invoiceNo: "INV-VAL-1",
        invoiceDate: "2026-10-10",
        items: [],
        paidNow: 0,
      });
    }).toThrow("Add at least one item.");

    expect(() => {
      supplierInvoicesRepo.createInvoice(db, {
        supplierId: supp.id,
        invoiceNo: "INV-VAL-2",
        invoiceDate: "2026-10-10",
        items: [
          { productId: prod.id, quantity: 1, unitCost: 100 },
          { productId: prod.id, quantity: 2, unitCost: 100 },
        ],
        paidNow: 0,
      });
    }).toThrow("Each product can appear only once per invoice.");

    expect(() => {
      supplierInvoicesRepo.createInvoice(db, {
        supplierId: supp.id,
        invoiceNo: "INV-VAL-3",
        invoiceDate: "2026-10-10",
        items: [{ productId: prod.id, quantity: 0, unitCost: 100 }],
        paidNow: 0,
      });
    }).toThrow("Enter a whole number of 1 or more.");

    expect(() => {
      supplierInvoicesRepo.createInvoice(db, {
        supplierId: supp.id,
        invoiceNo: "INV-VAL-4",
        invoiceDate: "2026-10-10",
        items: [{ productId: prod.id, quantity: 2, unitCost: 100 }],
        paidNow: 300,
      });
    }).toThrow("Amount paid cannot be more than the invoice total.");
  });

  it("SUP-3: failure part-way rolls back invoice, items and stock", () => {
    const db = openDatabase(":memory:");
    const supp = suppliersAdminRepo.saveSupplier(db, {
      name: "Supplier Rollback Test",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Prod 1', 'P1', 'Cat', 100, 200, 10, 2, 0),
             ('Prod 2', 'P2', 'Cat', 200, 300, 10, 2, 0)
    `).run();
    const p1 = db.prepare("SELECT id FROM products WHERE code = 'P1'").get() as { id: number };

    expect(() => {
      supplierInvoicesRepo.createInvoice(db, {
        supplierId: supp.id,
        invoiceNo: "INV-FAIL",
        invoiceDate: "2026-10-10",
        items: [
          { productId: p1.id, quantity: 5, unitCost: 150 },
          { productId: 9999, quantity: 5, unitCost: 150 },
        ],
        paidNow: 0,
      });
    }).toThrow();

    const invoiceCount = db.prepare("SELECT COUNT(*) AS c FROM supplier_invoices").get() as { c: number };
    expect(invoiceCount.c).toBe(0);

    const p1After = db.prepare("SELECT quantity, cost FROM products WHERE id = ?").get(p1.id) as { quantity: number; cost: number };
    expect(p1After.quantity).toBe(10);
    expect(p1After.cost).toBe(100);
  });
});

describe("SUP-4 requirement tests", () => {
  it("SUP-4: payment settles oldest invoices first and part-pays the last", () => {
    const db = openDatabase(":memory:");
    const supp = suppliersAdminRepo.saveSupplier(db, {
      name: "Worked Example Supplier",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO supplier_invoices (supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (?, 'INV-A', '2026-10-02', 3000000, 3000000, '2026-10-02 10:00'),
             (?, 'INV-B', '2026-10-12', 2000000, 500000, '2026-10-12 10:00'),
             (?, 'INV-C', '2026-10-20', 3000000, 0, '2026-10-20 10:00')
    `).run(supp.id, supp.id, supp.id);

    const detailAfterPayment = supplierInvoicesRepo.recordPayment(db, {
      supplierId: supp.id,
      amount: 2000000,
    });

    expect(detailAfterPayment.due).toBe(2500000);

    const invB = detailAfterPayment.invoices.find((i) => i.invoiceNo === "INV-B");
    expect(invB?.paidAmount).toBe(2000000);
    expect(invB?.status).toBe("PAID");

    const invC = detailAfterPayment.invoices.find((i) => i.invoiceNo === "INV-C");
    expect(invC?.paidAmount).toBe(500000);
    expect(invC?.status).toBe("DUE");
  });

  it("SUP-4: overpayment is rejected with the formatted balance", () => {
    const db = openDatabase(":memory:");
    const supp = suppliersAdminRepo.saveSupplier(db, {
      name: "Overpay Supplier",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO supplier_invoices (supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (?, 'INV-A', '2026-10-02', 4500000, 0, '2026-10-02 10:00')
    `).run(supp.id);

    expect(() => {
      supplierInvoicesRepo.recordPayment(db, {
        supplierId: supp.id,
        amount: 4500001,
      });
    }).toThrow("Payment is more than the balance due (Rs. 45,000).");
  });

  it("SUP-4: zero and negative payments are rejected", () => {
    const db = openDatabase(":memory:");
    const supp = suppliersAdminRepo.saveSupplier(db, {
      name: "Zero Pay Supplier",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    expect(() => {
      supplierInvoicesRepo.recordPayment(db, {
        supplierId: supp.id,
        amount: 0,
      });
    }).toThrow("Enter an amount greater than 0.");

    expect(() => {
      supplierInvoicesRepo.recordPayment(db, {
        supplierId: supp.id,
        amount: -100,
      });
    }).toThrow("Enter an amount greater than 0.");
  });

  it("SUP-4: writes a supplier_payments row", () => {
    const db = openDatabase(":memory:");
    const supp = suppliersAdminRepo.saveSupplier(db, {
      name: "Payment Row Supplier",
      contactName: null,
      phone: null,
      address: null,
      supplies: null,
    });

    db.prepare(`
      INSERT INTO supplier_invoices (supplier_id, invoice_no, invoice_date, total, paid_amount, created_at)
      VALUES (?, 'INV-1', '2026-10-02', 100000, 0, '2026-10-02 10:00')
    `).run(supp.id);

    supplierInvoicesRepo.recordPayment(db, {
      supplierId: supp.id,
      amount: 40000,
    });

    const paymentRows = db.prepare("SELECT * FROM supplier_payments WHERE supplier_id = ?").all(supp.id) as {
      amount: number;
      paid_at: string;
    }[];
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0]?.amount).toBe(40000);
    expect(paymentRows[0]?.paid_at).toBeDefined();
  });
});

describe("SUP-5 requirement tests", () => {
  it("SUP-5: supplier detail returns contact info, due and invoices with items newest first", () => {
    const db = openDatabase(":memory:");
    const supp = suppliersAdminRepo.saveSupplier(db, {
      name: "Detail Test Supplier",
      contactName: "John Contact",
      phone: "9812345678",
      address: "Kathmandu",
      supplies: "General Goods",
    });

    db.prepare(`
      INSERT INTO products (name, code, category, cost, price, quantity, reorder_level, archived)
      VALUES ('Item 1', 'I1', 'Cat', 100, 200, 10, 2, 0),
             ('Item 2', 'I2', 'Cat', 200, 300, 10, 2, 0)
    `).run();
    const p1 = db.prepare("SELECT id FROM products WHERE code = 'I1'").get() as { id: number };
    const p2 = db.prepare("SELECT id FROM products WHERE code = 'I2'").get() as { id: number };

    supplierInvoicesRepo.createInvoice(db, {
      supplierId: supp.id,
      invoiceNo: "INV-OLD",
      invoiceDate: "2026-10-01",
      items: [{ productId: p1.id, quantity: 5, unitCost: 100 }],
      paidNow: 500,
    });

    supplierInvoicesRepo.createInvoice(db, {
      supplierId: supp.id,
      invoiceNo: "INV-NEW",
      invoiceDate: "2026-10-15",
      items: [
        { productId: p1.id, quantity: 2, unitCost: 110 },
        { productId: p2.id, quantity: 3, unitCost: 210 },
      ],
      paidNow: 200,
    });

    const detail = suppliersAdminRepo.getSupplierDetail(db, supp.id);
    expect(detail.id).toBe(supp.id);
    expect(detail.name).toBe("Detail Test Supplier");
    expect(detail.contactName).toBe("John Contact");
    expect(detail.phone).toBe("9812345678");
    expect(detail.address).toBe("Kathmandu");
    expect(detail.supplies).toBe("General Goods");

    expect(detail.invoices).toHaveLength(2);
    expect(detail.invoices[0]?.invoiceNo).toBe("INV-NEW");
    expect(detail.invoices[0]?.items).toHaveLength(2);
    expect(detail.invoices[0]?.items[0]?.productName).toBe("Item 1");
    expect(detail.invoices[0]?.items[1]?.productName).toBe("Item 2");

    expect(detail.invoices[1]?.invoiceNo).toBe("INV-OLD");
    expect(detail.due).toBe(650);
  });
});
