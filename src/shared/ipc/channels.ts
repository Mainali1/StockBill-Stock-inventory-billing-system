import type { ChannelName } from "./index";

export const CHANNELS = [
  "app:getVersion",
  "auth:status",
  "auth:setup",
  "auth:login",
  "auth:logout",
  "inventory:list",
  "inventory:categories",
  "inventory:save",
  "inventory:delete",
  "suppliers:listActive",
  "suppliers:productOptions",
  "suppliers:list",
  "suppliers:get",
  "suppliers:save",
  "suppliers:delete",
  "invoices:create",
  "payments:record",
  "sales:picker",
  "sales:save",
  "sales:day",
  "sales:update",
  "sales:delete",
  "dashboard:get",
  "reports:get",
  "reports:exportCsv",
] as const satisfies readonly ChannelName[];

type Assert<T extends true> = T;

/**
 * Compile-time guarantee that the runtime list and the contract never drift.
 * If a channel is added to `IpcChannels` but not here (or the other way round)
 * this type resolves to `Assert<false>` and the typecheck fails.
 */
export type ChannelsMatchContract = Assert<
  ChannelName extends (typeof CHANNELS)[number]
    ? (typeof CHANNELS)[number] extends ChannelName
      ? true
      : false
    : false
>;
