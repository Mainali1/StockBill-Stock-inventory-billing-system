import type { ErrorCode } from "@shared/ipc/common";

/**
 * A failure that the IPC layer knows how to translate into an error result.
 * Anything that is not a `DomainError` becomes an `INTERNAL` error.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.fields = fields;
  }
}
