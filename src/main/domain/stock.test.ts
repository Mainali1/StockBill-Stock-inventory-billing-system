import { describe, expect, it } from "vitest";
import { productStatus } from "./stock";

describe("STOCK domain helper", () => {
  it("STOCK: productStatus returns OUT when quantity is 0", () => {
    expect(productStatus(0, 10)).toBe("OUT");
    expect(productStatus(-1, 10)).toBe("OUT");
  });

  it("STOCK: productStatus returns LOW when 0 < quantity <= reorderLevel", () => {
    expect(productStatus(1, 10)).toBe("LOW");
    expect(productStatus(10, 10)).toBe("LOW");
  });

  it("STOCK: productStatus returns IN_STOCK when quantity > reorderLevel", () => {
    expect(productStatus(11, 10)).toBe("IN_STOCK");
    expect(productStatus(20, 10)).toBe("IN_STOCK");
  });
});
