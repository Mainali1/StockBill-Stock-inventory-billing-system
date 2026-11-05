import type { AuthChannels } from "./auth";
import type { InventoryChannels } from "./inventory";
import type { ReportsChannels } from "./reports";
import type { SalesChannels } from "./sales";
import type { SuppliersChannels } from "./suppliers";

export type IpcChannels = AuthChannels &
  InventoryChannels &
  SuppliersChannels &
  SalesChannels &
  ReportsChannels;

export type ChannelName = keyof IpcChannels;

export type {
  ApiError,
  ApiResult,
  ErrorCode,
  InvoiceStatus,
  ProductStatus,
} from "./common";
