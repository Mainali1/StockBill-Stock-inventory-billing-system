import type { MockModule } from "../mockApi";

let shopName = "Demo Mart";
let hasUser = true;
let signedIn = false;
let currentUsername: string | null = null;
let failedAttempts = 0;
let lockoutUntil = 0;

const authMock: MockModule = {
  "app:getVersion": () => ({ version: "0.0.0" }),

  "auth:status": () => {
    return {
      hasUser,
      signedIn,
      username: currentUsername,
      shopName,
    };
  },

  "auth:setup": (rawInput: unknown) => {
    const input = rawInput as {
      shopName: string;
      username: string;
      password: string;
      confirmPassword: string;
    };
    if (hasUser) {
      throw new Error("Setup is already complete.");
    }
    shopName = input.shopName;
    hasUser = true;
    signedIn = true;
    currentUsername = input.username;
    return {
      username: input.username,
      shopName: input.shopName,
    };
  },

  "auth:login": (rawInput: unknown) => {
    const input = rawInput as { username: string; password: string };
    const now = Date.now();
    if (lockoutUntil > now) {
      const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
      throw new Error(
        `Too many failed attempts. Locked out for ${remainingSeconds} seconds.`,
      );
    }

    if (input.password !== "password123") {
      failedAttempts += 1;
      if (failedAttempts >= 5) {
        lockoutUntil = Date.now() + 30000;
        failedAttempts = 0;
        throw new Error("Too many failed attempts. Locked out for 30 seconds.");
      }
      throw new Error("Invalid username or password.");
    }

    failedAttempts = 0;
    lockoutUntil = 0;
    signedIn = true;
    currentUsername = input.username;
    return {
      username: input.username,
      shopName,
    };
  },

  "auth:logout": () => {
    signedIn = false;
    currentUsername = null;
  },
};

export default authMock;
