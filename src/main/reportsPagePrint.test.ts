import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("REP-7: Print stylesheet", () => {
  it("REP-7: print stylesheet hides navigation and controls", () => {
    const printCssPath = path.resolve(__dirname, "../renderer/styles/print.css");
    const content = fs.readFileSync(printCssPath, "utf-8");

    expect(content).toContain("@media print");
    expect(content).toMatch(/no-print/);
    expect(content).toContain("display: none");
  });
});
