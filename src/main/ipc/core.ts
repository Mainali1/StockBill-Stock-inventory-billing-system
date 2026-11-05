import type BetterSqlite3 from "better-sqlite3";
import { app } from "electron";
import { z } from "zod";
import { handle } from "./handle";

interface CountRow {
  count: number;
}

interface SettingRow {
  value: string;
}

/** The two handlers that every build provides: the version and the auth status. */
export function register(_db: BetterSqlite3.Database): void {
  handle("app:getVersion", z.void(), { auth: false }, () => ({ version: app.getVersion() }));

  handle("auth:status", z.void(), { auth: false }, (_input, ctx) => {
    const users = ctx.db.prepare("SELECT COUNT(*) AS count FROM users").get() as CountRow;
    const shopName = ctx.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("shop_name") as SettingRow | undefined;

    return {
      hasUser: users.count > 0,
      signedIn: ctx.session !== null,
      username: ctx.session?.username ?? null,
      shopName: shopName?.value ?? null,
    };
  });
}
