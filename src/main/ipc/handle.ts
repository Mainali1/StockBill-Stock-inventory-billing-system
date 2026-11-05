import type BetterSqlite3 from "better-sqlite3";
import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { ZodError, ZodType } from "zod";
import type { ChannelName } from "@shared/ipc";
import type { ApiResult, ErrorCode } from "@shared/ipc/common";
import { DomainError } from "../domain/errors";
import { getSession, type Session } from "../session";

export interface HandlerContext {
  db: BetterSqlite3.Database;
  session: Session | null;
}

let database: BetterSqlite3.Database | null = null;

/** The registered database, set once by `registerAllHandlers`. */
export function setDatabase(db: BetterSqlite3.Database): void {
  database = db;
}

const registeredChannels = new Set<string>();

/** Channel names that already have a real handler. */
export function getRegisteredChannels(): ReadonlySet<string> {
  return registeredChannels;
}

function validationError(error: ZodError): ApiResult<never> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  }
  return {
    ok: false,
    error: {
      code: "VALIDATION" satisfies ErrorCode,
      message: "Please check the highlighted fields.",
      fields,
    },
  };
}

/**
 * Builds the asynchronous function that every handler shares: validate input,
 * check the session when required, call the feature function and turn thrown
 * errors into results. Exported for tests that do not need Electron.
 */
export function createHandler<In, Out>(
  schema: ZodType<In>,
  options: { auth: boolean },
  fn: (input: In, ctx: HandlerContext) => Out | Promise<Out>,
): (rawInput: unknown, ctx: HandlerContext) => Promise<ApiResult<Out>> {
  return async (rawInput, ctx) => {
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    if (options.auth && ctx.session === null) {
      return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in." } };
    }

    try {
      const data = await fn(parsed.data, ctx);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof DomainError) {
        return {
          ok: false,
          error: { code: error.code, message: error.message, fields: error.fields },
        };
      }
      console.error(error);
      return {
        ok: false,
        error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
      };
    }
  };
}

/** Registers a handler with `ipcMain` under the given channel name. */
export function handle<In, Out>(
  channel: ChannelName,
  schema: ZodType<In>,
  options: { auth: boolean },
  fn: (input: In, ctx: HandlerContext) => Out | Promise<Out>,
): void {
  const handler = createHandler(schema, options, fn);

  registeredChannels.add(channel);

  ipcMain.handle(channel, async (_event: IpcMainInvokeEvent, rawInput: unknown) => {
    if (database === null) {
      console.error(`No database registered before handling ${channel}.`);
      return {
        ok: false,
        error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
      } satisfies ApiResult<never>;
    }
    return handler(rawInput, { db: database, session: getSession() });
  });
}
