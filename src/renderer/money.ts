/**
 * Pure money formatting helpers for the renderer.
 * Keeps the renderer independent of src/main.
 */

export function paisaToRupeesString(paisa: number): string {
  const isNegative = paisa < 0;
  const abs = Math.abs(paisa);
  const rupees = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `${rupees}.${remainder.toString().padStart(2, "0")}`;
  return isNegative ? `-${formatted}` : formatted;
}

export function rupeesToPaisa(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) {
      throw new Error("Enter an amount of 0 or more, with at most 2 decimals.");
    }
    input = input.toString();
  }

  const cleaned = input.trim().replace(/,/g, "");
  if (cleaned.length === 0) {
    throw new Error("Enter an amount of 0 or more, with at most 2 decimals.");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error("Enter an amount of 0 or more, with at most 2 decimals.");
  }

  const parts = cleaned.split(".");
  const rupeePart = parts[0] ?? "0";
  const paisaPart = parts[1] ?? "";
  const rupees = parseInt(rupeePart, 10);
  const paisa = parseInt(paisaPart.padEnd(2, "0"), 10);

  return rupees * 100 + paisa;
}

export function formatTable(paisa: number): string {
  const rupees = Math.abs(paisa) / 100;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
  return paisa < 0 ? `-${formatted}` : formatted;
}
