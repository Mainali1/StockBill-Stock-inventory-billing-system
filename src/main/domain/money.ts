import { DomainError } from "./errors";

const VALIDATION_MSG = "Enter an amount of 0 or more, with at most 2 decimals.";

/**
 * Parses user input (string or number) into integer paisa.
 * Accepts "1,150", "1150.5", "0".
 * Throws DomainError('VALIDATION', 'Enter an amount of 0 or more, with at most 2 decimals.')
 * for negative values, more than 2 decimals, empty, or non-numeric input.
 * Must not use floating-point multiplication that can drift (parse the string parts).
 */
export function rupeesToPaisa(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) {
      throw new DomainError("VALIDATION", VALIDATION_MSG);
    }
    input = input.toString();
  }

  if (typeof input !== "string") {
    throw new DomainError("VALIDATION", VALIDATION_MSG);
  }

  const trimmed = input.trim();
  if (trimmed === "") {
    throw new DomainError("VALIDATION", VALIDATION_MSG);
  }

  const clean = trimmed.replace(/,/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    throw new DomainError("VALIDATION", VALIDATION_MSG);
  }

  const parts = clean.split(".");
  const rupeesPart = parts[0] ?? "";
  const paisaPart = (parts[1] ?? "").padEnd(2, "0");

  const rupees = parseInt(rupeesPart, 10);
  const paisa = parseInt(paisaPart, 10);

  if (Number.isNaN(rupees) || Number.isNaN(paisa)) {
    throw new DomainError("VALIDATION", VALIDATION_MSG);
  }

  return rupees * 100 + paisa;
}

/**
 * Returns plain "1150.50"-style text for form fields.
 */
export function paisaToRupeesString(p: number): string {
  if (!Number.isFinite(p) || p < 0) {
    p = 0;
  }
  const sign = p < 0 ? "-" : "";
  const abs = Math.abs(Math.round(p));
  const rupees = Math.floor(abs / 100);
  const paisa = abs % 100;
  return `${sign}${rupees}.${paisa.toString().padStart(2, "0")}`;
}

/**
 * Returns "Rs. 48,250" for whole rupees and "Rs. 48,250.50" when there are paisa.
 * Indian grouping through Intl.NumberFormat('en-IN').
 */
export function formatCard(p: number): string {
  const abs = Math.abs(Math.round(p));
  const hasPaisa = abs % 100 !== 0;
  const rupeesValue = abs / 100;

  const formatter = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: hasPaisa ? 2 : 0,
  });

  const formatted = formatter.format(rupeesValue);
  const sign = p < 0 ? "-" : "";
  return `${sign}Rs. ${formatted}`;
}

/**
 * Returns "3,220.50", always two decimals, no prefix.
 * Indian grouping through Intl.NumberFormat('en-IN').
 */
export function formatTable(p: number): string {
  const abs = Math.abs(Math.round(p));
  const rupeesValue = abs / 100;

  const formatter = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(rupeesValue);
  const sign = p < 0 ? "-" : "";
  return `${sign}${formatted}`;
}
