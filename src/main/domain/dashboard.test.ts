import { describe, expect, it } from "vitest";
import { buildWeekBars, isDateToday } from "./dashboard";
import { todayDb } from "./dates";

describe("DASH-1: Dashboard domain functions", () => {
  it("DASH-1: isDateToday correctly identifies today", () => {
    const today = todayDb();
    expect(isDateToday(today)).toBe(true);
    expect(isDateToday("1999-01-01")).toBe(false);
  });

  it("DASH-2: buildWeekBars generates 7 zero-filled bars starting Sunday", () => {
    const bars = buildWeekBars("2026-11-03", [
      { date: "2026-11-03", sales: 5000, profit: 1200 },
    ]);
    expect(bars).toHaveLength(7);
    expect(bars[0]?.label).toBe("Sun");
    expect(bars[0]?.date).toBe("2026-11-01");
    expect(bars[0]?.sales).toBe(0);

    expect(bars[2]?.label).toBe("Tue");
    expect(bars[2]?.date).toBe("2026-11-03");
    expect(bars[2]?.sales).toBe(5000);
    expect(bars[2]?.profit).toBe(1200);

    expect(bars[6]?.label).toBe("Sat");
    expect(bars[6]?.date).toBe("2026-11-07");
    expect(bars[6]?.sales).toBe(0);
  });
});
