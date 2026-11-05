import { describe, expect, it } from "vitest";
import { formatCard, formatTable, paisaToRupeesString, rupeesToPaisa } from "./money";

describe("MONEY domain helpers", () => {
  it("MONEY: parses valid rupee strings and numbers to paisa", () => {
    expect(rupeesToPaisa("0")).toBe(0);
    expect(rupeesToPaisa("1,150")).toBe(115000);
    expect(rupeesToPaisa("1150.5")).toBe(115050);
    expect(rupeesToPaisa("1150.50")).toBe(115050);
    expect(rupeesToPaisa("48250")).toBe(4825000);
    expect(rupeesToPaisa(1150.5)).toBe(115050);
    expect(rupeesToPaisa(0)).toBe(0);
  });

  it("MONEY: rejects invalid input, negative, empty, or >2 decimals", () => {
    expect(() => rupeesToPaisa("")).toThrow("Enter an amount of 0 or more, with at most 2 decimals.");
    expect(() => rupeesToPaisa("   ")).toThrow("Enter an amount of 0 or more, with at most 2 decimals.");
    expect(() => rupeesToPaisa("-10")).toThrow("Enter an amount of 0 or more, with at most 2 decimals.");
    expect(() => rupeesToPaisa("-0.5")).toThrow("Enter an amount of 0 or more, with at most 2 decimals.");
    expect(() => rupeesToPaisa("12.345")).toThrow("Enter an amount of 0 or more, with at most 2 decimals.");
    expect(() => rupeesToPaisa("abc")).toThrow("Enter an amount of 0 or more, with at most 2 decimals.");
    expect(() => rupeesToPaisa(-10)).toThrow("Enter an amount of 0 or more, with at most 2 decimals.");
  });

  it("MONEY: formats paisa to plain rupee string for form fields", () => {
    expect(paisaToRupeesString(115050)).toBe("1150.50");
    expect(paisaToRupeesString(0)).toBe("0.00");
    expect(paisaToRupeesString(5)).toBe("0.05");
  });

  it("MONEY: formats cards with en-IN numbering and Rs. prefix", () => {
    expect(formatCard(4825000)).toBe("Rs. 48,250");
    expect(formatCard(4825050)).toBe("Rs. 48,250.50");
    expect(formatCard(12000000)).toBe("Rs. 1,20,000");
    expect(formatCard(0)).toBe("Rs. 0");
  });

  it("MONEY: formats tables with en-IN numbering, always two decimals", () => {
    expect(formatTable(322050)).toBe("3,220.50");
    expect(formatTable(4825000)).toBe("48,250.00");
    expect(formatTable(0)).toBe("0.00");
  });
});
