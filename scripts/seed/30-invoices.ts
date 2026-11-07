import type BetterSqlite3 from "better-sqlite3";
import { createInvoice } from "../../src/main/db/repositories/supplierInvoices";
import { buildSalesPlan, DEMO_PRODUCTS } from "./plan";

export default async function seed(
  db: BetterSqlite3.Database,
  ctx: { today: string }
): Promise<void> {
  const plannedRows = buildSalesPlan(ctx.today);
  const plannedSoldMap = new Map<string, number>();
  for (const r of plannedRows) {
    plannedSoldMap.set(r.productName, (plannedSoldMap.get(r.productName) ?? 0) + r.quantity);
  }

  const products = db
    .prepare<[], { id: number; name: string; cost: number }>(
      "SELECT id, name, cost FROM products WHERE archived = 0"
    )
    .all();
  const prodMap = new Map(products.map((p) => [p.name, p]));

  const suppliers = db
    .prepare<[], { id: number; name: string }>(
      "SELECT id, name FROM suppliers WHERE archived = 0"
    )
    .all();
  const suppMap = new Map(suppliers.map((s) => [s.name, s.id]));

  function getQtyNeeded(prodName: string): number {
    const p = DEMO_PRODUCTS.find((dp) => dp.name === prodName);
    if (!p) throw new Error(`Demo product not found: ${prodName}`);
    const sold = plannedSoldMap.get(prodName) ?? 0;
    return p.finalQty + sold;
  }

  const basmatiTotal = getQtyNeeded("Basmati Rice 5kg");
  const basmatiInv1 = Math.round(basmatiTotal * 0.7);
  const basmatiInv6 = basmatiTotal - basmatiInv1;

  const lentilsQty = getQtyNeeded("Lentils 1kg");
  const wheatQty = getQtyNeeded("Wheat Flour 5kg");

  const pBasmati = prodMap.get("Basmati Rice 5kg")!;
  const pLentils = prodMap.get("Lentils 1kg")!;
  const pWheat = prodMap.get("Wheat Flour 5kg")!;
  const suppKoshi = suppMap.get("Koshi Wholesale")!;

  const inv1Items = [
    { productId: pBasmati.id, quantity: basmatiInv1, unitCost: pBasmati.cost },
    { productId: pLentils.id, quantity: lentilsQty, unitCost: pLentils.cost },
    { productId: pWheat.id, quantity: wheatQty, unitCost: pWheat.cost },
  ];
  const inv1Total = inv1Items.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);

  createInvoice(db, {
    supplierId: suppKoshi,
    invoiceNo: "KW-2026-014",
    invoiceDate: "2026-10-05",
    items: inv1Items,
    paidNow: inv1Total,
  });

  const suppEverest = suppMap.get("Everest Oil Depot")!;
  const pOil = prodMap.get("Sunflower Oil 1L")!;
  const oilQty = getQtyNeeded("Sunflower Oil 1L");

  const inv2Items = [{ productId: pOil.id, quantity: oilQty, unitCost: pOil.cost }];
  const inv2Total = inv2Items.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);

  createInvoice(db, {
    supplierId: suppEverest,
    invoiceNo: "EOD-0881",
    invoiceDate: "2026-10-08",
    items: inv2Items,
    paidNow: inv2Total,
  });

  const suppHimal = suppMap.get("Himal Traders")!;
  const pTea = prodMap.get("Tea 250g")!;
  const pSugar = prodMap.get("Sugar 1kg")!;
  const pSalt = prodMap.get("Salt 1kg")!;

  const teaQty = getQtyNeeded("Tea 250g");
  const sugarQty = getQtyNeeded("Sugar 1kg");
  const saltQty = getQtyNeeded("Salt 1kg");

  const inv3Items = [
    { productId: pTea.id, quantity: teaQty, unitCost: pTea.cost },
    { productId: pSugar.id, quantity: sugarQty, unitCost: pSugar.cost },
    { productId: pSalt.id, quantity: saltQty, unitCost: pSalt.cost },
  ];
  const inv3Total = inv3Items.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);

  createInvoice(db, {
    supplierId: suppHimal,
    invoiceNo: "HT-3302",
    invoiceDate: "2026-10-12",
    items: inv3Items,
    paidNow: Math.floor(inv3Total / 2),
  });

  const suppSagarmatha = suppMap.get("Sagarmatha Stationers")!;
  const pNotebook = prodMap.get("Notebook A4")!;
  const pPen = prodMap.get("Ballpoint Pen Pack")!;
  const pMarker = prodMap.get("Marker Set")!;

  const notebookQty = getQtyNeeded("Notebook A4");
  const penQty = getQtyNeeded("Ballpoint Pen Pack");
  const markerQty = getQtyNeeded("Marker Set");

  const inv4Items = [
    { productId: pNotebook.id, quantity: notebookQty, unitCost: pNotebook.cost },
    { productId: pPen.id, quantity: penQty, unitCost: pPen.cost },
    { productId: pMarker.id, quantity: markerQty, unitCost: pMarker.cost },
  ];

  createInvoice(db, {
    supplierId: suppSagarmatha,
    invoiceNo: "SS-207",
    invoiceDate: "2026-10-18",
    items: inv4Items,
    paidNow: 0,
  });

  const suppMechi = suppMap.get("Mechi Household Supplies")!;
  const pSoap = prodMap.get("Soap Bar")!;
  const pDetergent = prodMap.get("Detergent Powder 1kg")!;

  const soapQty = getQtyNeeded("Soap Bar");
  const detergentQty = getQtyNeeded("Detergent Powder 1kg");

  const inv5Items = [
    { productId: pSoap.id, quantity: soapQty, unitCost: pSoap.cost },
    { productId: pDetergent.id, quantity: detergentQty, unitCost: pDetergent.cost },
  ];
  const inv5Total = inv5Items.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);

  createInvoice(db, {
    supplierId: suppMechi,
    invoiceNo: "MH-118",
    invoiceDate: "2026-10-22",
    items: inv5Items,
    paidNow: inv5Total,
  });

  const inv6Items = [
    { productId: pBasmati.id, quantity: basmatiInv6, unitCost: pBasmati.cost },
  ];

  createInvoice(db, {
    supplierId: suppKoshi,
    invoiceNo: "KW-2026-019",
    invoiceDate: "2026-10-30",
    items: inv6Items,
    paidNow: 0,
  });
}
