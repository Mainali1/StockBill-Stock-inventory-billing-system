/**
 * Date and time domain helpers.
 * All calendar arithmetic is done using Date.UTC.
 */

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function nowDbDateTime(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const h = pad2(now.getHours());
  const min = pad2(now.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}`;
}

export function todayDb(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

export function inputToDb(v: string): string {
  return v.replace("T", " ");
}

export function dbToInput(v: string): string {
  return v.replace(" ", "T");
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return false;
  }
  const parts = s.split("-");
  const y = parseInt(parts[0] ?? "", 10);
  const m = parseInt(parts[1] ?? "", 10);
  const d = parseInt(parts[2] ?? "", 10);

  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function isValidDateTime(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) {
    return false;
  }
  const parts = s.split(" ");
  const datePart = parts[0] ?? "";
  const timePart = parts[1] ?? "";
  if (!isValidDate(datePart)) {
    return false;
  }
  const timeParts = timePart.split(":");
  const h = parseInt(timeParts[0] ?? "", 10);
  const min = parseInt(timeParts[1] ?? "", 10);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

export function dayOf(dt: string): string {
  return dt.slice(0, 10);
}

export function hourOf(dt: string): number {
  const timePart = dt.includes(" ") ? dt.split(" ")[1] : dt.split("T")[1];
  if (!timePart) return 0;
  return parseInt(timePart.slice(0, 2), 10);
}

function parseUtcDate(dateStr: string): Date {
  const [y = 1970, m = 1, d = 1] = dateStr.split("-").map((v) => parseInt(v, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, n: number): string {
  const d = parseUtcDate(date);
  d.setUTCDate(d.getUTCDate() + n);
  return formatUtcDate(d);
}

export function weekRange(date: string): { start: string; end: string } {
  const d = parseUtcDate(date);
  const dayOfWeek = d.getUTCDay(); // 0 is Sunday
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6));
  return {
    start: formatUtcDate(start),
    end: formatUtcDate(end),
  };
}

export function monthRange(date: string): { start: string; end: string } {
  const d = parseUtcDate(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const nextMonth = new Date(Date.UTC(y, m + 1, 1));
  const end = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000);
  return {
    start: formatUtcDate(start),
    end: formatUtcDate(end),
  };
}

export function eachDay(from: string, to: string): string[] {
  const results: string[] = [];
  let curr = from;
  while (curr <= to) {
    results.push(curr);
    curr = addDays(curr, 1);
  }
  return results;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function formatLong(date: string): string {
  const d = parseUtcDate(dayOf(date));
  const weekday = WEEKDAYS[d.getUTCDay()] ?? "";
  const day = d.getUTCDate();
  const month = MONTHS_LONG[d.getUTCMonth()] ?? "";
  const year = d.getUTCFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

export function formatShort(date: string, currentYear: number = new Date().getFullYear()): string {
  const d = parseUtcDate(dayOf(date));
  const day = d.getUTCDate();
  const month = MONTHS_SHORT[d.getUTCMonth()] ?? "";
  const year = d.getUTCFullYear();
  if (year === currentYear) {
    return `${day} ${month}`;
  }
  return `${day} ${month} ${year}`;
}
