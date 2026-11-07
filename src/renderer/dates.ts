/**
 * Pure date formatting helpers for the renderer.
 * Keeps renderer independent of main process.
 */

export function todayDb(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatShort(date: string, currentYear: number = new Date().getFullYear()): string {
  const parts = date.split("-");
  const year = parseInt(parts[0] ?? "0", 10);
  const month = parseInt(parts[1] ?? "1", 10);
  const day = parseInt(parts[2] ?? "1", 10);

  const monthName = MONTH_NAMES_SHORT[month - 1] ?? "Jan";

  if (year !== currentYear) {
    return `${day} ${monthName} ${year}`;
  }
  return `${day} ${monthName}`;
}
