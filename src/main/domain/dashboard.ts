import type { WeekBarDto } from "@shared/ipc/reports";
import { eachDay, todayDb, weekRange } from "./dates";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Checks if a date string in YYYY-MM-DD format is today.
 */
export function isDateToday(date: string, now?: Date): boolean {
  return date === todayDb(now);
}

/**
 * Builds Sunday-to-Saturday WeekBarDto array for the week containing `date`.
 * Days without sales are zero-filled.
 */
export function buildWeekBars(
  date: string,
  salesByDay: { date: string; sales: number; profit: number }[]
): WeekBarDto[] {
  const { start, end } = weekRange(date);
  const days = eachDay(start, end);

  const map = new Map<string, { sales: number; profit: number }>();
  for (const s of salesByDay) {
    map.set(s.date, { sales: s.sales, profit: s.profit });
  }

  return days.map((d, index) => {
    const entry = map.get(d);
    return {
      date: d,
      label: DAY_LABELS[index] ?? "",
      sales: entry?.sales ?? 0,
      profit: entry?.profit ?? 0,
    };
  });
}
