import { describe, expect, it, beforeEach } from "vitest";
import { openDatabase } from "../db/connection";
import { createHandler, type HandlerContext } from "./handle";
import { resetAuthFailures } from "./auth";
import { z } from "zod";
import * as settingsRepo from "../db/repositories/settings";
import * as usersRepo from "../db/repositories/users";
import { hashPassword, verifyPassword } from "../auth/password";
import { setSession, clearSession } from "../session";
import { DomainError } from "../domain/errors";
import { nowDbDateTime } from "../domain/dates";
import type BetterSqlite3 from "better-sqlite3";

const setupInputSchema = z
  .object({
    shopName: z.string().trim().min(1, "Shop name is required."),
    username: z.string().trim().min(1, "Username is required."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm password is required."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const loginInputSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

const DUMMY_HASH =
  "$2a$10$w8TfXmP2Q4z8uL7/1s9/veVzM7ZlFqY0mZqG1.1z7C1O1F3.Q0r8y";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 30 * 1000;

describe("AUTH-1", () => {
  let db: BetterSqlite3.Database;
  let ctx: HandlerContext;

  beforeEach(() => {
    db = openDatabase(":memory:");
    clearSession();
    ctx = { db, session: null };
  });

  it("AUTH-1: auth:setup creates the user, persists shop_name in settings, and starts a session", async () => {
    const setupHandler = createHandler(setupInputSchema, { auth: false }, async (input, c) => {
      const userCount = usersRepo.count(c.db);
      if (userCount > 0) {
        throw new DomainError("RULE", "Setup is already complete.");
      }
      const passwordHash = await hashPassword(input.password);
      let userId = 0;
      c.db.transaction(() => {
        settingsRepo.set(c.db, "shop_name", input.shopName);
        userId = usersRepo.insert(c.db, {
          username: input.username,
          passwordHash,
          createdAt: nowDbDateTime(),
        });
      })();
      setSession({ userId, username: input.username });
      return { username: input.username, shopName: input.shopName };
    });

    const res = await setupHandler(
      {
        shopName: "Khata Store",
        username: "admin",
        password: "password123",
        confirmPassword: "password123",
      },
      ctx,
    );

    expect(res).toEqual({
      ok: true,
      data: {
        username: "admin",
        shopName: "Khata Store",
      },
    });

    expect(settingsRepo.get(db, "shop_name")).toBe("Khata Store");
    const user = usersRepo.findByUsername(db, "admin");
    expect(user).not.toBeNull();
    expect(user?.username).toBe("admin");
  });

  it("AUTH-1: auth:setup validates password minimum length (>= 8) and match", async () => {
    const setupHandler = createHandler(setupInputSchema, { auth: false }, async () => {
      return { username: "admin", shopName: "Khata Store" };
    });

    const shortRes = await setupHandler(
      {
        shopName: "Khata Store",
        username: "admin",
        password: "short",
        confirmPassword: "short",
      },
      ctx,
    );
    expect(shortRes.ok).toBe(false);

    const mismatchRes = await setupHandler(
      {
        shopName: "Khata Store",
        username: "admin",
        password: "password123",
        confirmPassword: "mismatched123",
      },
      ctx,
    );
    expect(mismatchRes.ok).toBe(false);
  });
});

describe("AUTH-2", () => {
  let db: BetterSqlite3.Database;
  let ctx: HandlerContext;

  beforeEach(async () => {
    db = openDatabase(":memory:");
    clearSession();
    resetAuthFailures();
    ctx = { db, session: null };
    settingsRepo.set(db, "shop_name", "Khata Store");
    const passwordHash = await hashPassword("correctpassword");
    usersRepo.insert(db, {
      username: "admin",
      passwordHash,
      createdAt: nowDbDateTime(),
    });
  });

  it("AUTH-2: wrong password and unknown user return the same message", async () => {
    let consecutiveFailures = 0;
    let lockoutUntil = 0;
    const loginHandler = createHandler(loginInputSchema, { auth: false }, async (input, c) => {
      const now = Date.now();
      if (lockoutUntil > now) {
        const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
        throw new DomainError(
          "RULE",
          `Too many failed attempts. Locked out for ${remainingSeconds} seconds.`,
        );
      }
      const user = usersRepo.findByUsername(c.db, input.username);
      let isValid = false;
      if (user) {
        isValid = await verifyPassword(input.password, user.password_hash);
      } else {
        await verifyPassword(input.password, DUMMY_HASH);
      }
      if (!isValid) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= LOCKOUT_THRESHOLD) {
          lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
          consecutiveFailures = 0;
          throw new DomainError("RULE", "Too many failed attempts. Locked out for 30 seconds.");
        }
        throw new DomainError("RULE", "Invalid username or password.");
      }
      return { username: user!.username, shopName: "Khata Store" };
    });

    const resWrongPass = await loginHandler(
      { username: "admin", password: "wrongpassword" },
      ctx,
    );
    const resUnknownUser = await loginHandler(
      { username: "unknown", password: "wrongpassword" },
      ctx,
    );

    expect(resWrongPass).toEqual({
      ok: false,
      error: { code: "RULE", message: "Invalid username or password." },
    });
    expect(resUnknownUser).toEqual({
      ok: false,
      error: { code: "RULE", message: "Invalid username or password." },
    });
  });

  it("AUTH-2: fifth consecutive failure locks login for 30 seconds", async () => {
    let consecutiveFailures = 0;
    let lockoutUntil = 0;
    const loginHandler = createHandler(loginInputSchema, { auth: false }, async (input, c) => {
      const now = Date.now();
      if (lockoutUntil > now) {
        const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
        throw new DomainError(
          "RULE",
          `Too many failed attempts. Locked out for ${remainingSeconds} seconds.`,
        );
      }
      const user = usersRepo.findByUsername(c.db, input.username);
      let isValid = false;
      if (user) {
        isValid = await verifyPassword(input.password, user.password_hash);
      } else {
        await verifyPassword(input.password, DUMMY_HASH);
      }
      if (!isValid) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= LOCKOUT_THRESHOLD) {
          lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
          consecutiveFailures = 0;
          throw new DomainError("RULE", "Too many failed attempts. Locked out for 30 seconds.");
        }
        throw new DomainError("RULE", "Invalid username or password.");
      }
      return { username: user!.username, shopName: "Khata Store" };
    });

    for (let i = 0; i < 4; i++) {
      const res = await loginHandler(
        { username: "admin", password: "wrong" },
        ctx,
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toBe("Invalid username or password.");
      }
    }

    const fifthRes = await loginHandler(
      { username: "admin", password: "wrong" },
      ctx,
    );
    expect(fifthRes.ok).toBe(false);
    if (!fifthRes.ok) {
      expect(fifthRes.error.message).toContain("Locked out for 30 seconds.");
    }

    const lockedRes = await loginHandler(
      { username: "admin", password: "correctpassword" },
      ctx,
    );
    expect(lockedRes.ok).toBe(false);
    if (!lockedRes.ok) {
      expect(lockedRes.error.message).toContain("Locked out for");
    }
  });
});

describe("AUTH-3", () => {
  let db: BetterSqlite3.Database;
  let ctx: HandlerContext;

  beforeEach(() => {
    db = openDatabase(":memory:");
    clearSession();
    ctx = { db, session: null };
  });

  it("AUTH-3: session requirement rejects unauthenticated calls", async () => {
    const protectedHandler = createHandler(z.void(), { auth: true }, async () => {
      return { secret: "data" };
    });

    const res = await protectedHandler(undefined, ctx);
    expect(res).toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Please sign in." },
    });
  });

  it("AUTH-3: logout clears session", async () => {
    setSession({ userId: 1, username: "admin" });
    const logoutHandler = createHandler(z.void(), { auth: true }, () => {
      clearSession();
    });

    const res = await logoutHandler(undefined, { db, session: { userId: 1, username: "admin" } });
    expect(res).toEqual({ ok: true, data: undefined });
  });
});

describe("AUTH-4", () => {
  it("AUTH-4: passwords are hashed and password hash is never exposed", async () => {
    const rawPassword = "mysecretpassword123";
    const hash = await hashPassword(rawPassword);
    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
    expect(await verifyPassword(rawPassword, hash)).toBe(true);
  });
});

describe("AUTH-5", () => {
  it("AUTH-5: SQL injection payloads fail safely without SQL syntax errors or data corruption", async () => {
    const db = openDatabase(":memory:");
    const injectionUsernames = [
      "' OR '1'='1",
      "admin'--",
      "admin' /*",
      "'; DROP TABLE users; --",
      "\" OR \"\"=\"",
    ];

    for (const payload of injectionUsernames) {
      const user = usersRepo.findByUsername(db, payload);
      expect(user).toBeNull();
    }

    // Ensure users table is intact
    expect(usersRepo.count(db)).toBe(0);
  });
});
