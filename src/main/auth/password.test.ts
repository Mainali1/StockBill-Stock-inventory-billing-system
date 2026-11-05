import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("PASSWORD auth helpers", () => {
  it("PASSWORD: hashes with bcrypt and verifies correctly", async () => {
    const password = "admin12345";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);

    const matches = await verifyPassword(password, hash);
    expect(matches).toBe(true);

    const wrongMatches = await verifyPassword("wrongpassword", hash);
    expect(wrongMatches).toBe(false);
  });
});
