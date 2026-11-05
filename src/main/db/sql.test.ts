import { describe, expect, it } from "vitest";
import { escapeLike } from "./sql";

describe("SQL: escapeLike", () => {
  it("SQL: escapeLike escapes % _ and backslash", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("c:\\temp")).toBe("c:\\\\temp");
    expect(escapeLike("%_\\")).toBe("\\%\\_\\\\");
    expect(escapeLike("plain")).toBe("plain");
  });
});
