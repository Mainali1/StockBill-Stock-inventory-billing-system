import { z } from "zod";
import type BetterSqlite3 from "better-sqlite3";
import { handle } from "./handle";
import * as suppliersRepo from "../db/repositories/suppliers";
import * as suppliersAdminRepo from "../db/repositories/suppliersAdmin";
import * as supplierInvoicesRepo from "../db/repositories/supplierInvoices";

export function register(_db: BetterSqlite3.Database): void {
  handle("suppliers:listActive", z.void(), { auth: true }, async (_input, ctx) => {
    return suppliersRepo.listActive(ctx.db);
  });

  handle(
    "suppliers:productOptions",
    z.void(),
    { auth: true },
    async (_input, ctx) => {
      const stmt = ctx.db.prepare<[], { id: number; name: string; code: string | null; cost: number }>(`
        SELECT id, name, code, cost
        FROM products
        WHERE archived = 0
        ORDER BY name COLLATE NOCASE ASC
      `);
      return stmt.all();
    }
  );

  handle(
    "suppliers:list",
    z.object({ search: z.string().optional() }),
    { auth: true },
    async (input, ctx) => {
      return suppliersAdminRepo.listSuppliers(ctx.db, input);
    }
  );

  handle(
    "suppliers:get",
    z.object({ id: z.number().int() }),
    { auth: true },
    async (input, ctx) => {
      return suppliersAdminRepo.getSupplierDetail(ctx.db, input.id);
    }
  );

  handle(
    "suppliers:save",
    z.object({
      id: z.number().int().optional(),
      name: z.string(),
      contactName: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      supplies: z.string().nullable().optional(),
    }),
    { auth: true },
    async (input, ctx) => {
      return suppliersAdminRepo.saveSupplier(ctx.db, {
        id: input.id,
        name: input.name,
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        supplies: input.supplies ?? null,
      });
    }
  );

  handle(
    "suppliers:delete",
    z.object({ id: z.number().int() }),
    { auth: true },
    async (input, ctx) => {
      return suppliersAdminRepo.deleteSupplier(ctx.db, input.id);
    }
  );

  handle(
    "invoices:create",
    z.object({
      supplierId: z.number().int(),
      invoiceNo: z.string(),
      invoiceDate: z.string(),
      items: z.array(
        z.object({
          productId: z.number().int(),
          quantity: z.number().int(),
          unitCost: z.number().int(),
        })
      ),
      paidNow: z.number().int(),
    }),
    { auth: true },
    async (input, ctx) => {
      return supplierInvoicesRepo.createInvoice(ctx.db, input);
    }
  );

  handle(
    "payments:record",
    z.object({
      supplierId: z.number().int(),
      amount: z.number().int(),
    }),
    { auth: true },
    async (input, ctx) => {
      return supplierInvoicesRepo.recordPayment(ctx.db, input);
    }
  );
}
