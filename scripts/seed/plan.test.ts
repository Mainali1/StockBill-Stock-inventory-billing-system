import { describe, expect, it } from "vitest";
import { buildSalesPlan, DEMO_PRODUCTS } from "./plan";
import { dayOf, hourOf } from "../../src/main/domain/dates";

describe("SEED plan generator", () => {
  it("SEED: plan is deterministic", () => {
    const plan1 = buildSalesPlan("2026-11-03");
    const plan2 = buildSalesPlan("2026-11-03");

    expect(plan1).toEqual(plan2);

    const dates = new Set(plan1.map((r) => dayOf(r.soldAt)));
    expect(dates.size).toBe(10);

    const countsPerDay = new Map<string, number>();
    for (const r of plan1) {
      const d = dayOf(r.soldAt);
      countsPerDay.set(d, (countsPerDay.get(d) ?? 0) + 1);
    }
    const uniqueCounts = new Set(countsPerDay.values());
    expect(uniqueCounts.size).toBeGreaterThan(1);
    for (const count of countsPerDay.values()) {
      expect(count).toBeGreaterThanOrEqual(6);
      expect(count).toBeLessThanOrEqual(14);
    }

    const hours = new Set(plan1.map((r) => hourOf(r.soldAt)));
    expect(hours.size).toBeGreaterThanOrEqual(8);
    for (const h of hours) {
      expect(h).toBeGreaterThanOrEqual(9);
      expect(h).toBeLessThanOrEqual(20);
    }

    const prodMap = new Map(DEMO_PRODUCTS.map((p) => [p.name, p]));
    const soldTotals = new Map<string, number>();

    for (const r of plan1) {
      const p = prodMap.get(r.productName);
      expect(p).toBeDefined();
      expect(r.unitPrice).toBe(p?.price);
      expect(r.quantity).toBeGreaterThanOrEqual(1);
      expect(r.quantity).toBeLessThanOrEqual(4);

      soldTotals.set(r.productName, (soldTotals.get(r.productName) ?? 0) + r.quantity);
    }

    // Total planned quantity per product is reasonable and bounded
    for (const [prodName, soldQty] of soldTotals.entries()) {
      const p = prodMap.get(prodName);
      expect(p).toBeDefined();
      expect(soldQty).toBeGreaterThan(0);
    }
  });
});
