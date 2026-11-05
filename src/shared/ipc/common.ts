export type ErrorCode =
  | "VALIDATION" | "UNAUTHENTICATED" | "NOT_FOUND" | "CONFLICT" | "RULE" | "LOCKED" | "INTERNAL";

export interface ApiError {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type ProductStatus = "IN_STOCK" | "LOW" | "OUT";
export type InvoiceStatus = "PAID" | "DUE";
