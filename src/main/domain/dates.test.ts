import { describe, expect, it } from "vitest";
import {
  addDays,
  dbToInput,
  eachDay,
  formatLong,
  formatShort,
  hourOf,
  inputToDb,
  isValidDate,
  isValidDateTime,
  monthRange,
  nowDbDateTime,
  todayDb,
  weekRange,
} from "./dates";

describe("DATES domain helpers", () => {
  it("DATES: nowDbDateTime and todayDb format correctly", () => {
    const fixedDate = new Date(2026, 10, 3, 14, 30);
    expect(nowDbDateTime(fixedDate)).toBe("2026-11-03 14:30");
    expect(todayDb(fixedDate)).toBe("2026-11-03");
  });

  it("DATES: inputToDb and dbToInput handle T separator conversion", () => {
    expect(inputToDb("2026-11-03T14:30")).toBe("2026-11-03 14:30");
    expect(dbToInput("2026-11-03 14:30")).toBe("2026-11-03T14:30");
  });

  it("DATES: isValidDate and isValidDateTime reject invalid dates and date-times", () => {
    expect(isValidDate("2026-11-03")).toBe(true);
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("invalid")).toBe(false);

    expect(isValidDateTime("2026-11-03 14:30")).toBe(true);
    expect(isValidDateTime("2026-11-03 23:59")).toBe(true);
    expect(isValidDateTime("2026-02-30 10:00")).toBe(false);
    expect(isValidDateTime("2026-11-03 24:00")).toBe(false);
    expect(isValidDateTime("2026-11-03 12:60")).toBe(false);
  });

  it("DATES: hourOf extracts 0-23 hour number", () => {
    expect(hourOf("2026-11-03 14:30")).toBe(14);
    expect(hourOf("2026-11-03 00:05")).toBe(0);
    expect(hourOf("2026-11-03 23:59")).toBe(23);
  });

  it("DATES: addDays adds days correctly", () => {
    expect(addDays("2026-11-03", 2)).toBe("2026-11-05");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("DATES: weekRange returns Sunday to Saturday", () => {
    expect(weekRange("2026-11-03")).toEqual({
      start: "2026-11-01",
      end: "2026-11-07",
    });
    expect(weekRange("2026-11-01")).toEqual({
      start: "2026-11-01",
      end: "2026-11-07",
    });
    expect(weekRange("2026-11-07")).toEqual({
      start: "2026-11-01",
      end: "2026-11-07",
    });
  });

  it("DATES: monthRange returns first and last day of month", () => {
    expect(monthRange("2026-02-10")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(monthRange("2024-02-10")).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
    expect(monthRange("2026-11-03")).toEqual({
      start: "2026-11-01",
      end: "2026-11-30",
    });
  });

  it("DATES: eachDay returns all inclusive days", () => {
    expect(eachDay("2026-11-01", "2026-11-04")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
  });

  it("DATES: formatLong formats full date string", () => {
    expect(formatLong("2026-11-03")).toBe("Tuesday, 3 November 2026");
    expect(formatLong("2026-11-03 14:30")).toBe("Tuesday, 3 November 2026");
  });

  it("DATES: formatShort formats short date string depending on currentYear", () => {
    expect(formatShort("2026-10-20", 2026)).toBe("20 Oct");
    expect(formatShort("2025-10-20", 2026)).toBe("20 Oct 2025");
  });
});
