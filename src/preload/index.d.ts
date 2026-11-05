import type { StockBillApi } from "./index";

declare global {
  interface Window {
    api: StockBillApi;
  }
}

export {};
