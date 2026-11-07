import { z } from "zod";
import { DomainError } from "../domain/errors";
import { handle } from "./handle";
import { hashPassword, verifyPassword } from "../auth/password";
import { setSession, clearSession } from "../session";
import * as settingsRepo from "../db/repositories/settings";
import * as usersRepo from "../db/repositories/users";
import { nowDbDateTime } from "../domain/dates";

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

let consecutiveFailures = 0;
let lockoutUntil = 0;

export function resetAuthFailures(): void {
  consecutiveFailures = 0;
  lockoutUntil = 0;
}

export function register(): void {
  handle("auth:status", z.void(), { auth: false }, (_input, ctx) => {
    const hasUser = usersRepo.count(ctx.db) > 0;
    const shopName = settingsRepo.get(ctx.db, "shop_name");
    const signedIn = ctx.session !== null;
    return {
      hasUser,
      signedIn,
      username: ctx.session?.username ?? null,
      shopName: shopName ?? null,
    };
  });

  handle("auth:setup", setupInputSchema, { auth: false }, async (input, ctx) => {
    const userCount = usersRepo.count(ctx.db);
    if (userCount > 0) {
      throw new DomainError("RULE", "Setup is already complete.");
    }

    const passwordHash = await hashPassword(input.password);

    let userId = 0;
    ctx.db.transaction(() => {
      settingsRepo.set(ctx.db, "shop_name", input.shopName);
      userId = usersRepo.insert(ctx.db, {
        username: input.username,
        passwordHash,
        createdAt: nowDbDateTime(),
      });
    })();

    setSession({
      userId,
      username: input.username,
    });

    return {
      username: input.username,
      shopName: input.shopName,
    };
  });

  handle("auth:login", loginInputSchema, { auth: false }, async (input, ctx) => {
    const now = Date.now();
    if (lockoutUntil > now) {
      const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
      throw new DomainError(
        "RULE",
        `Too many failed attempts. Locked out for ${remainingSeconds} seconds.`,
      );
    }

    const user = usersRepo.findByUsername(ctx.db, input.username);

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
        throw new DomainError(
          "RULE",
          "Too many failed attempts. Locked out for 30 seconds.",
        );
      }
      throw new DomainError("RULE", "Invalid username or password.");
    }

    consecutiveFailures = 0;
    lockoutUntil = 0;

    setSession({
      userId: user!.id,
      username: user!.username,
    });

    const shopName = settingsRepo.get(ctx.db, "shop_name") ?? "";

    return {
      username: user!.username,
      shopName,
    };
  });

  handle("auth:logout", z.void(), { auth: true }, () => {
    clearSession();
  });
}
