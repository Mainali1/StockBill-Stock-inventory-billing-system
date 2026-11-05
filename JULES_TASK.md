# Jules task: StockBill, built one phase per run

Active phase: P0

(Only the line above changes between runs. Valid values: P0, P1, P2, P3, P4, P5, P6, P7. Execute only the task whose number matches. Read "Ground rules", "Shared reference" and your own task section. Ignore the other task sections.)

Repo: `StockBill-Stock-inventory-billing-system` (Electron, React 18, TypeScript strict, SQLite through `better-sqlite3`, npm, Node 22).
Open one PR per run against the default branch. Never push to `main` directly.

## Ground rules

- Read, in this order: `AGENTS.md`, `docs/SPEC.md`, `docs/TRACKER.md`, `design/*.png`. If `AGENTS.md`, `SPEC.md` or `TRACKER.md` is missing, stop and say which in the PR description. A missing screenshot is not a blocker; log it in the TRACKER agent log.
- Readiness check: every phase listed under "Depends on" in the TRACKER status table must be `done`. If not, stop and name the unfinished phase. Never build a dependency yourself.
- Test first. For every requirement ID in your task: one commit that adds failing tests whose names start with the ID (`SAL-2: refuses to sell more than stock`), then one commit that makes them pass. Commit messages are Conventional Commits with the requirement ID as scope: `test(SAL-2): ...`, `feat(SAL-2): ...`.
- No dependency outside the list in task P0 section 0a. If something seems missing, write it yourself.
- Never edit `AGENTS.md`, `docs/SPEC.md` or anything in `design/`. If you find a conflict between files, follow the priority order in `AGENTS.md` and log the conflict in the TRACKER agent log.
- A skeleton already exists (task S, see `SKELETON_TASK.md`): dependencies, lockfile, every configuration file, the folder layout, database connection and migrations, the IPC contract and wrapper, preload, and the router shell. It is finished and fixed.
- Never run `npm install <package>`, `npm update` or any command that changes `package.json` dependencies or `package-lock.json`. Install with `npm ci` only. Never edit `package.json` scripts, `tsconfig*.json`, `electron.vite.config.ts`, `vite.web.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc` or `.gitignore`. If a package or a setting seems missing, write the code without it and list the need under "Noticed but not changed" in the PR.
- Never commit `node_modules`, `out`, `dist`, `demo` or `*.db` files.
- Never import Node or Electron modules (`fs`, `path`, `os`, `crypto`, `electron`, `better-sqlite3`, `node:*`) in `src/renderer/**`. The renderer talks to the main process only through `window.api`. Node and Electron imports are allowed only in `src/main/**`, `src/preload/**` and `scripts/**`.
- Only P7 may edit `.github/` or `electron-builder.yml`.
- Files owned by P0 (shared components, router, NavBar, tokens, `src/shared/ipc/*`, IPC wrapper, domain helpers, migrations, shared repositories, seed runner) may be edited by later phases only for a minimal, necessary change. Log each such change in the TRACKER agent log with the reason.
- Do not touch another phase's files. Parallel phases (P2, P3, P4) must stay inside their own files.
- Run `npm run verify` before finishing. Phases that change UI also run `npm run build`. Do not finish while either fails.
- No TODO comments, no dead code, no bracketed placeholder text, no hard-coded sample data in the UI. Numbers and names in `design/` screenshots are illustrations only.
- PR description has four parts: Summary; Acceptance checklist with each box ticked or explained; Decisions you made where this file was silent; Noticed but not changed.

## What we are building, in one paragraph

StockBill lets one shop owner keep stock under control. The owner keeps a product list with cost, price, quantity and reorder level; records invoices received from suppliers (which add stock and create amounts owed); records what was sold, per item, at a chosen date and time (which removes stock); and reads a dashboard and reports for any day or range. There are no customers, no payment methods, no tax and no receipts. The app is one offline desktop program with one owner account. It will be defended in a viva, so it must be simple to explain and every rule must be covered by a test.

## Terminology

- **Product**: an item the shop stocks. Quantities are whole units.
- **Sale row**: one product sold in one quantity at one date-time and one unit price. A "day" is the set of sale rows whose date part matches.
- **Supplier invoice**: a document from a supplier. Saving one adds stock and may leave an amount due.
- **Due**: for a supplier, the sum of (invoice total minus amount paid) over its invoices.
- **Paisa**: 1/100 rupee. All money in the database, the IPC contract and domain code is an integer number of paisa.
- **Low stock**: `0 < quantity <= reorder_level`. **Out**: `quantity = 0`. The dashboard "Low-stock items" count includes both.

## Decisions already made (do not reopen)

- Selling more than the stock on hand is blocked.
- Supplier invoices cannot be edited or deleted after saving.
- Saving a supplier invoice sets each product's cost to that invoice's unit cost (last-cost method).
- Sale rows snapshot `unit_price` and `unit_cost`. Old rows never change when a product's price or cost changes.
- Gross profit equals sales minus cost of goods, from the snapshots. No tax anywhere.
- Quantities are whole numbers. Money input allows at most 2 decimals.
- Dates and times are local-time strings, no timezone.
- Weeks run Sunday to Saturday.
- There is exactly one user, created on first launch.

---

## Shared reference

### Result envelope and error codes

Every IPC handler returns `ApiResult<T>`. Handlers never throw to the renderer. Error `message` is user-readable. Never include stack traces or SQL in a message.

| code | when |
|---|---|
| `VALIDATION` | input failed zod validation or a field rule. Include `fields` (field name to message) when it maps to form fields. |
| `UNAUTHENTICATED` | no session on a handler that needs one |
| `NOT_FOUND` | record does not exist |
| `CONFLICT` | uniqueness violated (duplicate code, duplicate invoice number, duplicate supplier name) |
| `RULE` | a business rule refused the action (oversell, overpayment, negative stock) |
| `LOCKED` | login temporarily locked |
| `INTERNAL` | anything unexpected. Message is always `Something went wrong. Please try again.` |

### IPC contract (P0 creates these files verbatim; later phases implement against them)

Create these type-only files. Names and shapes are fixed. Money is integer paisa. Dates are `YYYY-MM-DD`, date-times are `YYYY-MM-DD HH:MM`.

`src/shared/ipc/common.ts`
```ts
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
```

`src/shared/ipc/auth.ts`
```ts
export interface AuthChannels {
  "app:getVersion": { in: void; out: { version: string } };
  "auth:status": {
    in: void;
    out: { hasUser: boolean; signedIn: boolean; username: string | null; shopName: string | null };
  };
  "auth:setup": {
    in: { shopName: string; username: string; password: string; confirmPassword: string };
    out: { username: string; shopName: string };
  };
  "auth:login": { in: { username: string; password: string }; out: { username: string; shopName: string } };
  "auth:logout": { in: void; out: void };
}
```

`src/shared/ipc/inventory.ts`
```ts
import type { ProductStatus } from "./common";

export interface ProductDto {
  id: number;
  name: string;
  code: string | null;
  category: string;
  supplierId: number | null;
  supplierName: string | null;
  cost: number;
  price: number;
  quantity: number;
  reorderLevel: number;
  status: ProductStatus;
}

export interface ProductInput {
  id?: number;
  name: string;
  code: string | null;
  category: string;
  supplierId: number | null;
  cost: number;
  price: number;
  quantity: number;
  reorderLevel: number;
}

export interface InventoryChannels {
  "inventory:list": {
    in: { search?: string; category?: string | null; lowOnly?: boolean };
    out: ProductDto[];
  };
  "inventory:categories": { in: void; out: string[] };
  "inventory:save": { in: ProductInput; out: { product: ProductDto; warnings: string[] } };
  "inventory:delete": { in: { id: number }; out: { result: "deleted" | "archived" } };
}
```

`src/shared/ipc/suppliers.ts`
```ts
import type { InvoiceStatus } from "./common";

export interface SupplierSummaryDto {
  id: number;
  name: string;
  supplies: string | null;
  lastInvoiceDate: string | null;
  due: number;
}

export interface InvoiceItemDto {
  productId: number;
  productName: string;
  quantity: number;
  unitCost: number;
}

export interface InvoiceDto {
  id: number;
  supplierId: number;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  total: number;
  paidAmount: number;
  status: InvoiceStatus;
  items: InvoiceItemDto[];
}

export interface SupplierDetailDto {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  supplies: string | null;
  due: number;
  invoices: InvoiceDto[];
}

export interface SupplierInput {
  id?: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  supplies: string | null;
}

export interface InvoiceInput {
  supplierId: number;
  invoiceNo: string;
  invoiceDate: string;
  items: { productId: number; quantity: number; unitCost: number }[];
  paidNow: number;
}

export interface SuppliersChannels {
  "suppliers:listActive": { in: void; out: { id: number; name: string }[] };
  "suppliers:productOptions": { in: void; out: { id: number; name: string; code: string | null; cost: number }[] };
  "suppliers:list": { in: { search?: string }; out: { suppliers: SupplierSummaryDto[]; totalDue: number } };
  "suppliers:get": { in: { id: number }; out: SupplierDetailDto };
  "suppliers:save": { in: SupplierInput; out: SupplierDetailDto };
  "suppliers:delete": { in: { id: number }; out: { result: "deleted" | "archived" } };
  "invoices:create": { in: InvoiceInput; out: InvoiceDto };
  "payments:record": { in: { supplierId: number; amount: number }; out: SupplierDetailDto };
}
```

`src/shared/ipc/sales.ts`
```ts
export interface SalePickerProductDto {
  id: number;
  name: string;
  code: string | null;
  category: string;
  quantity: number;
  price: number;
}

export interface SaleLineInput {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface SaleRowDto {
  id: number;
  soldAt: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
  profit: number;
}

export interface DaySalesDto {
  date: string;
  total: number;
  profit: number;
  count: number;
  /** 24 entries, index = hour 0 to 23, value = sales in paisa */
  hourly: number[];
  rows: SaleRowDto[];
}

export interface SalesChannels {
  "sales:picker": {
    in: { search?: string; category?: string | null };
    out: { products: SalePickerProductDto[]; categories: string[] };
  };
  "sales:save": { in: { soldAt: string; lines: SaleLineInput[] }; out: DaySalesDto };
  "sales:day": { in: { date: string }; out: DaySalesDto };
  "sales:update": { in: { id: number; quantity: number; unitPrice: number; soldAt: string }; out: void };
  "sales:delete": { in: { id: number }; out: void };
}
```

`src/shared/ipc/reports.ts`
```ts
import type { InvoiceStatus, ProductStatus } from "./common";

export interface WeekBarDto { date: string; label: string; sales: number; profit: number }

export interface DashboardDto {
  date: string;
  isToday: boolean;
  sales: number;
  profit: number;
  lowStockCount: number;
  supplierDue: number;
  week: WeekBarDto[];
  restock: { productId: number; name: string; quantity: number }[];
  recentInvoices: {
    id: number; supplierId: number; invoiceNo: string; supplierName: string; total: number; status: InvoiceStatus;
  }[];
}

export type ReportTab = "sales" | "profit" | "stock" | "dues";

export interface DayBucketDto { date: string; sales: number; profit: number; count: number }

export interface SalesReportDto {
  tab: "sales";
  total: number;
  count: number;
  byDay: DayBucketDto[];
  /** present only when from === to, 24 entries */
  byHour: number[] | null;
}

export interface ProfitReportDto {
  tab: "profit";
  totalSales: number;
  costOfGoods: number;
  grossProfit: number;
  count: number;
  byDay: DayBucketDto[];
  top: { productId: number; name: string; sold: number; sales: number; profit: number }[];
}

export interface StockReportDto {
  tab: "stock";
  valuation: number;
  productCount: number;
  low: { id: number; name: string; quantity: number; reorderLevel: number; status: ProductStatus }[];
}

export interface DuesReportDto {
  tab: "dues";
  suppliers: { id: number; name: string; due: number }[];
  totalDue: number;
}

export type ReportDto = SalesReportDto | ProfitReportDto | StockReportDto | DuesReportDto;

export interface ReportsChannels {
  "dashboard:get": { in: { date: string }; out: DashboardDto };
  "reports:get": { in: { tab: ReportTab; from: string; to: string }; out: ReportDto };
  "reports:exportCsv": {
    in: { tab: ReportTab; from: string; to: string };
    out: { saved: boolean; path: string | null };
  };
}
```

`src/shared/ipc/index.ts` exports `IpcChannels = AuthChannels & InventoryChannels & SuppliersChannels & SalesChannels & ReportsChannels` and `ChannelName = keyof IpcChannels`.

### Demo data (used by the seed script, phases P0, P3, P4)

Shop name `Demo Mart`, user `admin` / `admin12345`.

Suppliers (contact names and phones are obviously fake demo values, phones like `9800000001`):

| name | supplies |
|---|---|
| Koshi Wholesale | Grocery staples |
| Everest Oil Depot | Cooking oil |
| Himal Traders | Tea, sugar, salt |
| Sagarmatha Stationers | Stationery |
| Mechi Household Supplies | Soap, cleaning |

Products (money in rupees here; store as paisa). `final qty` is the stock on hand after the whole seed has run.

| name | category | supplier | cost | price | final qty | reorder at |
|---|---|---|---|---|---|---|
| Basmati Rice 5kg | Grocery | Koshi Wholesale | 980 | 1150 | 24 | 10 |
| Lentils 1kg | Grocery | Koshi Wholesale | 140 | 170 | 35 | 15 |
| Wheat Flour 5kg | Grocery | Koshi Wholesale | 520 | 600 | 18 | 8 |
| Sunflower Oil 1L | Grocery | Everest Oil Depot | 270 | 320 | 4 | 12 |
| Tea 250g | Grocery | Himal Traders | 235 | 280 | 2 | 8 |
| Sugar 1kg | Grocery | Himal Traders | 95 | 110 | 60 | 20 |
| Salt 1kg | Grocery | Himal Traders | 22 | 28 | 0 | 15 |
| Notebook A4 | Stationery | Sagarmatha Stationers | 72 | 90 | 5 | 15 |
| Ballpoint Pen Pack | Stationery | Sagarmatha Stationers | 45 | 60 | 40 | 12 |
| Marker Set | Stationery | Sagarmatha Stationers | 120 | 160 | 22 | 6 |
| Soap Bar | Household | Mechi Household Supplies | 36 | 45 | 80 | 25 |
| Detergent Powder 1kg | Household | Mechi Household Supplies | 130 | 160 | 14 | 10 |

Result: LOW = Sunflower Oil, Tea, Notebook A4; OUT = Salt. Product `code` is null in the seed except Basmati Rice (`RICE5`) and Sugar (`SUG1`).

---

## Task P0: UI kit, domain helpers, seed and mock mode

The skeleton already delivered, and you must not rewrite: 0a (dependencies, scripts, configs), 0b (folders), 0c connection, migrations, `escapeLike` and `docs/schema.sql`, the contract files, 0e (`DomainError`, session, IPC wrapper, auto-registration, preload, renderer `call`, handlers `app:getVersion` and `auth:status`), 0g (router, guard, placeholder pages), the styles (`tokens.css`, `base.css`, `print.css`), and the components `PageFrame`, `PageHeader`, `NavBar`. Verify they exist and work, then build only what is left.

Your P0 scope:
- 0c shared repositories (`products`, `suppliers`, `settings`, `users`) and the `suppliers:listActive` handler.
- 0d domain helpers: `money.ts`, `dates.ts`, `stock.ts`, with their tests.
- 0f remaining shared components: `Panel`, `Stamp`, `StatCard`, `DataTable`, `Button`, `Chip`, `Field`, `TextInput`, `Select`, `BarChart`, `ConfirmDialog`, `ToastProvider` with `useToast`, `EmptyState`, `Loading`, each with its test.
- 0h seed runner, `scripts/seed/plan.ts`, `scripts/seed/10-core.ts`, and `src/main/auth/password.ts`.
- 0i tests for your scope (the DB, SQL, IPC and guard tests already exist).
- 0j the full mock layer: extend the existing `src/renderer/dev/mockApi.ts` where needed and add `src/renderer/dev/mock/` files for `suppliers:listActive`.
- 0k README additions (seed section).

Where the rest of this task text says "create" something the skeleton already has, treat it as verify-only. Ignore any instruction in this task to change scripts, dependencies or configuration files.

### 0a. Project scaffold and dependencies

Scaffold with the `electron-vite` React and TypeScript template structure, then reshape it to the folder layout in `AGENTS.md`. Use the latest stable Electron and a `better-sqlite3` version that has a prebuilt binary for it.

Runtime dependencies: `better-sqlite3`, `bcryptjs`, `zod`, `react`, `react-dom`, `react-router-dom`, `@fontsource/fraunces`, `@fontsource/inter`, `@fontsource/courier-prime`. If a font package name does not exist, use the nearest official `@fontsource` package for the same family and log it.

Dev dependencies: `electron`, `electron-vite`, `electron-builder`, `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `prettier`, `tsx`, and type packages (`@types/better-sqlite3`, `@types/react`, `@types/react-dom`, `@types/node`).

`package.json` fields: `"name": "stockbill"`, `"version": "0.0.0"`, a one-line `description`, `"author"`, `"main": "./out/main/index.js"`, `"engines": { "node": ">=22" }`. Commit `package-lock.json`.

Scripts (exact):

| script | command |
|---|---|
| `dev` | `npm run rebuild:electron && electron-vite dev` |
| `dev:web` | Vite dev server for the renderer only, with the mock API (see 0j) |
| `build` | `electron-vite build` |
| `dist` | `npm run build && electron-builder --publish never` |
| `typecheck` | `tsc --noEmit` for every tsconfig project |
| `lint` | `eslint .` |
| `test` | `npm run rebuild:node && vitest run` |
| `verify` | `npm run typecheck && npm run lint && npm test` |
| `rebuild:node` | `npm rebuild better-sqlite3` |
| `rebuild:electron` | `electron-builder install-app-deps` |
| `seed:demo` | `npm run rebuild:node && tsx scripts/seed-demo.ts` |

No script may use shell-specific syntax. Vitest runs two projects: `main` (node environment, `src/main/**`, `src/shared/**`, `scripts/**`, `tests/**`) and `renderer` (jsdom, `src/renderer/**`). Strict TypeScript everywhere. ESLint flat config with `typescript-eslint`, `react-hooks`, and a rule forbidding imports of `electron`, `better-sqlite3`, `fs`, `path` and `node:*` inside `src/renderer/**`. Prettier config committed.

### 0b. Folder layout

Exactly as `AGENTS.md`. Create empty feature folders with a `.gitkeep` only where a later phase will add files.

### 0c. Database layer

`src/main/db/connection.ts`: `openDatabase(path: string): Database` opens SQLite, runs `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` (skip WAL for `:memory:`), then runs migrations. Tests use `openDatabase(":memory:")`.

`src/main/db/migrate.ts`: reads migration files through Vite `import.meta.glob('./migrations/*.sql', { query: '?raw', import: 'default', eager: true })`, sorts by filename, applies each in its own transaction, and records it in `schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`. Running twice applies nothing the second time. Vitest must also resolve `import.meta.glob` (Vite handles it).

`src/main/db/migrations/001_init.sql` (exact schema):

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  address TEXT,
  supplies TEXT,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  category TEXT NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id),
  cost INTEGER NOT NULL CHECK (cost >= 0),
  price INTEGER NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  reorder_level INTEGER NOT NULL CHECK (reorder_level >= 0),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
);

CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0),
  sold_at TEXT NOT NULL CHECK (sold_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]')
);

CREATE TABLE supplier_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  invoice_no TEXT NOT NULL,
  invoice_date TEXT NOT NULL CHECK (invoice_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  total INTEGER NOT NULL CHECK (total >= 0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (supplier_id, invoice_no),
  CHECK (paid_amount <= total)
);

CREATE TABLE supplier_invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES supplier_invoices(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0)
);

CREATE TABLE supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  paid_at TEXT NOT NULL
);

CREATE INDEX idx_sales_sold_at ON sales(sold_at);
CREATE INDEX idx_sales_product ON sales(product_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_invoices_supplier_date ON supplier_invoices(supplier_id, invoice_date);
```

Mirror this schema in `docs/schema.sql` (generate it from the migration, do not retype).

Shared repositories in `src/main/db/repositories/` (raw SQL, prepared statements, bound parameters, each function takes the `Database` as its first argument):
- `products.ts`: `getById`, `listForPicker({search, category})` (non-archived), `adjustStock(db, productId, delta)` which throws a `DomainError('RULE', ...)` if the result would be negative.
- `suppliers.ts`: `getById`, `listActive`.
- `settings.ts`: `get(key)`, `set(key, value)`.
- `users.ts`: `count`, `findByUsername`, `insert`.

A search term used in `LIKE` must be escaped for `%`, `_` and `\` with `ESCAPE '\'`. Put one helper `escapeLike()` in `src/main/db/sql.ts` and test it.

### 0d. Domain helpers (pure, in `src/main/domain/`, no electron or fs imports)

`errors.ts`: `class DomainError extends Error { code: ErrorCode; fields?: Record<string,string> }`.

`money.ts`:
- `rupeesToPaisa(input: string | number): number` parses user input. Accepts `"1,150"`, `"1150.5"`, `"0"`. Throws `DomainError('VALIDATION', 'Enter an amount of 0 or more, with at most 2 decimals.')` for negative values, more than 2 decimals, empty, or non-numeric input. Must not use floating-point multiplication that can drift (parse the string parts).
- `paisaToRupeesString(p: number): string` returns plain `"1150.50"`-style text for form fields.
- `formatCard(p: number): string` returns `Rs. 48,250` for whole rupees and `Rs. 48,250.50` when there are paisa. Indian grouping through `Intl.NumberFormat('en-IN')`.
- `formatTable(p: number): string` returns `3,220.50`, always two decimals, no prefix.

`dates.ts` (no `Date` local-time surprises: do calendar arithmetic with `Date.UTC`):
- `nowDbDateTime(now?: Date): string` local `YYYY-MM-DD HH:MM`.
- `todayDb(now?: Date): string` local `YYYY-MM-DD`.
- `inputToDb(v: string)` turns `2026-11-03T14:30` into `2026-11-03 14:30`; `dbToInput(v)` reverses it.
- `isValidDate(s)` and `isValidDateTime(s)` reject impossible dates such as `2026-02-30` and `2026-13-01 10:00`.
- `dayOf(dt)`, `hourOf(dt)` (0 to 23 number).
- `addDays(date, n)`.
- `weekRange(date)` returns `{ start, end }` Sunday to Saturday. `weekRange('2026-11-03')` is `{ start: '2026-11-01', end: '2026-11-07' }`.
- `monthRange(date)` returns first and last day. `monthRange('2026-02-10')` is `{ start: '2026-02-01', end: '2026-02-28' }`.
- `eachDay(from, to)` returns every date inclusive.
- `formatLong(date)` returns `Tuesday, 3 November 2026`. `formatShort(date, currentYear)` returns `20 Oct`, and `20 Oct 2025` when the year differs from `currentYear`.

`stock.ts`: `productStatus(quantity, reorderLevel): ProductStatus`.

### 0e. IPC pattern

- `src/shared/ipc/channels.ts`: runtime list of channel names (kept in sync with the contract by a type-level test).
- `src/main/session.ts`: `getSession(): { userId: number; username: string } | null`, `setSession(s)`, `clearSession()`. In-memory only.
- `src/main/ipc/handle.ts`: `handle(channel, schema, options: { auth: boolean }, fn)` registers `ipcMain.handle`. It parses input with the zod schema (failure returns `VALIDATION` with `fields`), checks the session when `auth` is true (failure returns `UNAUTHENTICATED` with message `Please sign in.`), calls `fn(input, ctx)` where `ctx` has `db` and `session`, converts `DomainError` into an error result, and converts any other exception into `INTERNAL` after logging it with `console.error`. For unit tests export `createHandler(schema, options, fn)` that returns the same function without Electron.
- `src/preload/index.ts`: exposes `window.api.invoke(channel, payload)` through `contextBridge`, typed from `IpcChannels`.
- `src/renderer/api.ts`: `call(channel, payload)` returns `data` or throws `ApiCallError` carrying `code`, `message`, `fields`.
- Implement handlers `app:getVersion` (unauthenticated, returns `app.getVersion()`) and `auth:status` (unauthenticated, reads the users table and session) and `suppliers:listActive` (authenticated).
- `src/main/index.ts` creates the window (min size 1100x700, default 1280x900, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), opens the database at `path.join(app.getPath('userData'), 'stockbill.db')`, registers handlers, and loads the renderer. Never disable `webSecurity`. Block navigation away from the app and block new windows.

### 0f. Design tokens and shared components

Read `design/*.png` and `docs/SPEC.md` section 3. `src/renderer/styles/tokens.css` defines the palette variables, type scale, spacing scale (4px base), border widths. `base.css` sets zero border radius, body background (radial gradient), focus ring (2px outline in `--red`, offset 2px), font imports. `print.css` hides navigation and controls.

Build these in `src/renderer/components/` with typed props and a test each for the behaviour noted:

- `PageFrame({ children })`: 2px ink border, soft shadow, 32px margin.
- `NavBar()`: wordmark `StockBill`, links Dashboard, Sales, Inventory, Suppliers, Reports with the active link in red and underlined, username on the right with a `Sign out` button (calls `auth:logout`, then goes to `/login`).
- `PageHeader({ title, subtitle?, right? })`.
- `Panel({ title, children, footer? })`: the bordered side panel.
- `Stamp({ kind: 'paid'|'due'|'low'|'out'|'in-stock'|'neutral', children? })`: deterministic rotation between -2 and 2 degrees derived from the label text. Test: same input gives the same rotation.
- `StatCard({ label, value, tone?: 'default'|'good'|'bad' })`: dashed border.
- `DataTable<T>({ columns, rows, rowKey, onRowClick?, selectedKey?, emptyTitle, emptyHint? })`: columns have `header`, `align`, `mono`, `render`. Empty state renders `EmptyState`. Test: renders rows, calls `onRowClick`, shows empty state.
- `Button({ variant: 'primary'|'secondary'|'danger', ... })`, `Chip({ selected, onClick })`, `Field({ label, error?, hint?, children })`, `TextInput`, `Select`.
- `BarChart({ groups: { label: string; values: { value: number; tone: 'ink' | 'green' }[] }[], height?, valueFormatter? })`: CSS bars scaled to the largest value in the chart; ink bars carry the small cream corner triangle; a group with value 0 shows a 2px baseline; every bar has a `title` and `aria-label`. Test: heights are proportional, zero renders baseline, two series render side by side.
- `ConfirmDialog({ open, title, message, confirmLabel, destructive?, onConfirm, onCancel })` built on `<dialog>`; closes on Escape.
- `ToastProvider` and `useToast()` with `success(message)` and `error(message)`; toasts auto-dismiss after 4 seconds and have `role="status"`.
- `EmptyState({ title, hint? })` and `Loading()`.

### 0g. Router and guard

`HashRouter` with routes `/setup`, `/login`, `/` (Dashboard), `/sales`, `/inventory`, `/suppliers`, `/reports`. The Dashboard, Sales, Inventory, Suppliers and Reports pages are placeholders inside `PageFrame` with a `PageHeader` only. Guard behaviour from `auth:status`: no user leads to `/setup`; user but not signed in leads to `/login`; signed in on `/setup` or `/login` leads to `/`. Setup and Login render centered cards without `NavBar`. Test the guard with a mocked API for all three states.

### 0h. Seed runner

`scripts/seed-demo.ts` deletes and recreates a database file (default `./demo/stockbill-demo.db`, overridable with `--out <path>`), runs migrations, then runs every file in `scripts/seed/` in filename order (loaded by directory listing, so later phases add files without editing the runner). Each seed file default-exports `seed(db: Database, ctx: { today: string })`. The runner prints the path and a row count per table. Document in the README how to point the app at the demo file: environment variable `STOCKBILL_DB` overrides the database path in `src/main/index.ts` (tests and seed only; the packaged app ignores it unless set).

P0 creates:
- `scripts/seed/plan.ts`: exports the supplier and product tables from "Demo data" above and `buildSalesPlan(today: string)`, a pure deterministic function (mulberry32 PRNG seeded with `20261103`) returning planned sale rows for the 10 days ending on `today` (inclusive): 6 to 14 rows per day with a different count each day (weekday weights, Thursday and Saturday heaviest), hours between 09 and 20, quantity 1 to 4, products weighted toward cheaper staples, every row at the product's price. Test: same input gives identical output; 10 distinct dates; row counts differ across days; hours span at least 8 different values; total planned quantity per product is below that product's planned stock.
- `scripts/seed/10-core.ts`: inserts the user (through the same hashing function P1 will export from `src/main/auth/password.ts`; in P0 create that file with `hashPassword` and `verifyPassword` using `bcryptjs` cost 10 and a test), the `shop_name` setting, suppliers, and products with quantity 0.

### 0i. Tests required in P0

Name the tests with the area, since P0 has no requirement IDs: `DB: migrations apply once`, `DB: foreign keys are enforced`, `DB: sold_at format is enforced`, `SQL: escapeLike escapes % _ and backslash`, `MONEY: ...`, `DATES: ...` (include the worked examples above), `STOCK: ...`, `IPC: rejects invalid input`, `IPC: rejects missing session`, `IPC: maps DomainError and hides internal errors`, `GUARD: ...`, component tests from 0f, `SEED: plan is deterministic`.

### 0j. Browser mock mode (for visual checks and renderer tests)

`npm run dev:web` serves the renderer in a normal browser. When `window.api` is undefined, `src/renderer/dev/mockApi.ts` installs an in-memory implementation of the typed API. Handlers live in `src/renderer/dev/mock/*.ts` and are registered by `import.meta.glob`, so later phases add their own file. P0 provides mocks for `app:getVersion` and `auth:status` (query string `?state=setup|login|signedin` selects the state, default `signedin`). The mock must return the same envelope and DTO shapes as the contract. Renderer tests use the same mock layer.

### 0k. README

Sections: What it is, Requirements (Node 22), Install, Run (`npm run dev`), Test (`npm test`), Native module note (`rebuild:node` vs `rebuild:electron`), Seed demo data, Project layout, npm scripts table.

### Acceptance checklist (P0)

- [ ] `npm install`, `npm run verify` and `npm run build` pass on a clean clone.
- [ ] `npm run dev:web` shows the placeholder pages inside the page frame with correct fonts, colors, zero radius and visible focus rings; `?state=setup` and `?state=login` show centered cards.
- [ ] Every contract file exists and matches this document.
- [ ] `npm run seed:demo` creates the demo database with the user, 5 suppliers, 12 products.
- [ ] The migration test, date examples (`weekRange('2026-11-03')`, `monthRange('2026-02-10')`) and money examples (`formatCard(4825000)` is `Rs. 48,250`, `formatCard(12000000)` is `Rs. 1,20,000`, `formatTable(322050)` is `3,220.50`) pass.
- [ ] No script contains shell-specific syntax; `package.json` version is `0.0.0`.
- [ ] `docs/TRACKER.md` P0 tasks ticked, status `done`, agent log entry added.

---

## Task P1: Authentication (AUTH-1 to AUTH-5, REL-4)

Depends on P0. Files you own: `src/main/auth/*` (except `password.ts`, created in P0, which you may extend), `src/main/ipc/auth.ts`, `src/renderer/pages/Setup*`, `src/renderer/pages/Login*`, `src/renderer/dev/mock/auth.ts`, tests.

### 1a. Handlers (contract in `src/shared/ipc/auth.ts`)

| channel | auth | behaviour |
|---|---|---|
| `auth:status` | no | already exists from P0; keep it |
| `auth:setup` | no | Allowed only while the users table is empty, otherwise `RULE` with `Setup has already been completed.` Validates input, hashes the password with bcrypt cost 10, inserts the user and the `shop_name` setting in one transaction, signs the user in. Returns `{ username, shopName }`. |
| `auth:login` | no | See 1b. Returns `{ username, shopName }` and sets the session. |
| `auth:logout` | yes | Clears the session. |
| `app:getVersion` | no | Exists from P0; verify with a test and do not change. |

### 1b. Rules and exact messages

Setup validation (zod, returned as `VALIDATION` with `fields`):
- `shopName`: trimmed, 1 to 60 characters. Message `Enter your shop name.`
- `username`: trimmed, lowercased, 3 to 32 characters, only `a-z 0-9 _ . -`. Message `Use 3 to 32 letters, numbers, dots, dashes or underscores.`
- `password`: 8 to 72 characters (bcrypt ignores bytes after 72). Message `Use at least 8 characters.` (and `Use at most 72 characters.` above the limit).
- `confirmPassword`: must equal `password`. Message `Passwords do not match.`

Login:
- Username is trimmed and lowercased before lookup.
- Any failed attempt returns `UNAUTHENTICATED` with the single message `Incorrect username or password.` The message is identical for an unknown user and a wrong password.
- When the username does not exist, still run one bcrypt comparison against a fixed dummy hash so response time does not reveal which usernames exist.
- Lockout: keep a counter of consecutive failures in memory in the main process. After the 5th consecutive failure, every login attempt for 30 seconds returns `LOCKED` with `Too many attempts. Try again in N seconds.` (N is the remaining whole seconds, minimum 1). A successful login resets the counter. The clock is injectable so tests do not sleep.
- A password longer than 72 characters is treated as an ordinary wrong password.
- The password hash never appears in any return value, log line or error.

### 1c. Screens

Match `design/login.png` for the card, spacing and type. Differences from the mock: subtitle reads `{shopName} · Stock keeping`; no `OWNER ONLY` stamp; no `Forgot password?` link; bottom-right text reads `Version {x.y.z}` in Courier Prime, read through `app:getVersion`.

Login card: title `Sign in`, helper text `Open the books with your login.`, fields Username and Password with a `Show` / `Hide` toggle button on the password field, full-width red `Sign in` button. Errors appear in red text above the button with `role="alert"`. While locked, the button is disabled and shows `Try again in {n}s` with a live countdown. Enter submits. Focus starts in Username.

Setup card (same frame, `design/login.png` styling): title `Set up your shop`, helper text `Create the owner login. You will use it every time you open StockBill.`, fields Shop name, Username, Password, Confirm password, button `Create account`. Field errors show under each field. The same version text bottom-right.

Mock mode: `src/renderer/dev/mock/auth.ts` implements all five channels with the same rules (including lockout) so the screens can be checked with `npm run dev:web`.

### 1d. Tests (names start with the ID)

- `AUTH-1: setup creates the only user and signs in`
- `AUTH-1: setup is refused once a user exists`
- `AUTH-1: setup validation messages` (one case per rule above)
- `AUTH-2: wrong password and unknown user return the same message`
- `AUTH-2: fifth consecutive failure locks login for 30 seconds` (injected clock; message shows remaining seconds)
- `AUTH-2: lock expires after 30 seconds and success resets the counter`
- `AUTH-2: unknown username still performs a bcrypt comparison` (spy on `verifyPassword`)
- `AUTH-3: handlers other than status, setup, login and version reject without a session`
- `AUTH-3: logout clears the session`
- `AUTH-4: stored password is a bcrypt hash and never equals the password`
- `AUTH-4: no handler result or error contains the hash` (serialize results and assert)
- `AUTH-5: injection payloads never authenticate` for `' OR '1'='1`, `' OR 1=1 --`, `admin'--`, `"; DROP TABLE users; --` as username and as password
- `AUTH-5: users table still exists and has one row after injection attempts`
- `REL-4: login and setup cards show the version from app:getVersion` (renderer test with the mock layer)
- Renderer: `Show` toggles input type; locked state disables the button; Enter submits.

### Acceptance checklist (P1)

- [ ] In `npm run dev:web` with `?state=setup` in the URL: setup with mismatched passwords shows `Passwords do not match.`; valid setup lands on the Dashboard placeholder with the username in the NavBar.
- [ ] Sign out returns to Login; five wrong passwords show the locked state with a countdown; the correct password is refused while locked.
- [ ] Login and Setup cards match `design/login.png` visually (same frame, type, button, spacing) apart from the listed differences. No stamp, no forgot link.
- [ ] Version text appears bottom-right on both cards.
- [ ] Browser developer tools network and logs contain no password or hash (verify in the real Electron app with `npm run dev` if the environment supports it; otherwise state that in the PR).
- [ ] `npm run verify` and `npm run build` pass. TRACKER P1 ticked, status `done`, agent log entry added.

---

## Task P2: Inventory (INV-1 to INV-5)

Depends on P0 and P1. Files you own: `src/main/db/repositories/inventory.ts`, `src/main/ipc/inventory.ts`, `src/renderer/pages/Inventory*` and its components, `src/renderer/dev/mock/inventory.ts`, tests.

### 2a. Handlers (contract in `src/shared/ipc/inventory.ts`; all require a session)

- `inventory:list`: non-archived products. `search` matches name or code, case-insensitive substring, escaped with `escapeLike`. `category` filters exact. `lowOnly` keeps products with `quantity <= reorder_level`. Order by name, case-insensitive. `supplierName` comes from a join. `status` comes from `productStatus`.
- `inventory:categories`: distinct categories of non-archived products, sorted.
- `inventory:save`: create when `id` is absent, update when present (`NOT_FOUND` for an unknown id or an archived product). Returns the saved product and `warnings`.
- `inventory:delete`: if the product appears in any `sales` or `supplier_invoice_items` row, set `archived = 1` and return `archived`; otherwise delete the row and return `deleted`.

### 2b. Validation (zod plus uniqueness check, exact messages, returned in `fields`)

| field | rule | message |
|---|---|---|
| `name` | trimmed, 1 to 80 characters | `Name is required.` |
| `category` | trimmed, 1 to 40 characters | `Category is required.` |
| `code` | optional; trimmed; empty becomes `null`; max 40 characters; unique among all products including archived | `That code is already used by {product name}.` (`CONFLICT`) |
| `supplierId` | optional; must exist and not be archived | `Choose a supplier from the list.` |
| `cost`, `price` | integer paisa, 0 or more | `Enter an amount of 0 or more, with at most 2 decimals.` |
| `quantity`, `reorderLevel` | integer 0 or more | `Enter a whole number of 0 or more.` |

Warning (not an error): when `price < cost`, return `warnings: ["Price is lower than cost. You will lose money on each sale."]`. The save still succeeds.

Editing `quantity` directly is allowed (manual stock correction).

### 2c. Screen

Match `design/inventory.png` for layout: list on the left, edit panel on the right.

- Header: `Inventory`, subtitle `Products, stock levels and prices`, red `Add product` button.
- Left: search input (`Search by name or code`, debounced 200 ms), chips `All`, one chip per category, and `Low stock only`. Chips and search combine. Table columns: Product, Category, Qty (bold; red when status is LOW or OUT), Cost, Price (both `formatTable`, right-aligned monospace), Status (stamp: `IN STOCK` green, `LOW` red, `OUT` red), and an `Edit` button. Clicking a row also selects it.
- Right panel: title `Edit product` for an existing product and `New product` after `Add product`. Fields: Name, Code (optional), Category (text input with a datalist of existing categories), Supplier (select from `suppliers:listActive` with a `No supplier` option), Cost (Rs.), Price (Rs.), Quantity, Reorder at. Money fields show rupee strings (`paisaToRupeesString`) and convert with `rupeesToPaisa` on save. Buttons: `Delete` (secondary, red text; hidden for a new product) and `Save changes` (primary). When the form is dirty and the user selects a different row, ask for confirmation with `ConfirmDialog` (`Discard unsaved changes?`).
- Field errors show under each field from `fields`. The price-below-cost warning shows as a muted-red note under the Price field while typing and as a toast after saving.
- `Delete` opens `ConfirmDialog`. On `archived`, toast `This product has sales or invoices, so it was archived instead of deleted.` On `deleted`, toast `Product deleted.`
- Empty states: no products (`No products yet`, hint `Add your first product with the button above.`); no matches (`No products match`, hint `Try a different search or filter.`).
- Opening the page with `?product=<id>` selects that product (the dashboard links here).
- Mock mode: `src/renderer/dev/mock/inventory.ts` implements the four channels with the same rules over an in-memory list seeded from the Demo data table.

### 2d. Tests (names start with the ID)

- `INV-1: search matches name or code case-insensitively`
- `INV-1: search treats % and _ literally`
- `INV-1: category and low-stock filters combine with search`
- `INV-1: archived products are never listed`
- `INV-2: creates a product and returns its status`
- `INV-2: rejects empty name and category with exact messages`
- `INV-2: rejects duplicate code and names the other product`
- `INV-2: empty code is stored as null and two products may both have no code`
- `INV-2: rejects negative or over-precise money, and non-integer quantities`
- `INV-2: rejects an archived or unknown supplier`
- `INV-3: status is OUT at 0, LOW at or below reorder level, otherwise IN_STOCK` (boundary values 0, reorder, reorder+1)
- `INV-4: product with a sale is archived, not deleted`
- `INV-4: product with a supplier invoice item is archived, not deleted`
- `INV-4: product with no history is deleted`
- `INV-5: price below cost returns the warning and still saves`
- SQL injection: `INV-1: search with ' OR '1'='1 returns nothing and changes nothing`
- Renderer: row selection fills the form; dirty-switch asks for confirmation; Delete asks for confirmation; stamps show the right label; `?product=` preselects.

### Acceptance checklist (P2)

- [ ] `npm run dev:web` shows Inventory matching `design/inventory.png` in layout and visual language, with the seeded rows.
- [ ] Search, category chips and `Low stock only` work together; `OUT` and `LOW` rows show red quantity and the correct stamp.
- [ ] Editing a product and saving updates the row; a duplicate code shows `That code is already used by ...` under Code.
- [ ] Price below cost shows the warning and still saves.
- [ ] Deleting a product with history shows the archived toast and removes it from the list.
- [ ] Empty states appear for an empty list and for no matches.
- [ ] Layout holds at 1280x900 and 1100x700 with no horizontal scroll.
- [ ] `npm run verify` and `npm run build` pass. TRACKER P2 ticked, status `done`, agent log entry added.

---

## Task P3: Suppliers and supplier invoices (SUP-1 to SUP-5)

Depends on P0 and P1. Files you own: `src/main/db/repositories/supplierInvoices.ts` and `suppliersAdmin.ts`, `src/main/ipc/suppliers.ts` (extends the `suppliers:listActive` handler from P0 in the same file), `src/renderer/pages/Suppliers*` and its components, `src/renderer/dev/mock/suppliers.ts`, `scripts/seed/30-invoices.ts`, tests.

### 3a. Handlers (contract in `src/shared/ipc/suppliers.ts`; all require a session)

- `suppliers:list`: non-archived suppliers with `lastInvoiceDate` (latest `invoice_date`, null if none) and `due` (sum of `total - paid_amount`). `search` matches supplier name or `supplies`, case-insensitive substring, escaped. Also returns `totalDue` across the returned suppliers. Order by name.
- `suppliers:get`: full detail with invoices newest first (by `invoice_date` desc, then `id` desc), each with its items.
- `suppliers:save`: create or update. `NOT_FOUND` for unknown id.
- `suppliers:delete`: archive when the supplier has any invoice or any product references it; otherwise delete. Archived suppliers disappear from lists and pickers; their products keep the reference and show the supplier name.
- `invoices:create`: see 3b.
- `payments:record`: see 3c.

### 3b. Create invoice (SUP-3), one SQLite transaction

Input: `supplierId`, `invoiceNo`, `invoiceDate`, `items[]`, `paidNow`.

Validation and messages:
- Supplier must exist and not be archived (`NOT_FOUND`).
- `invoiceNo`: trimmed, 1 to 40 characters. Message `Invoice number is required.` Unique per supplier: `This supplier already has an invoice with that number.` (`CONFLICT`).
- `invoiceDate`: valid `YYYY-MM-DD`. Message `Enter a valid date.`
- `items`: at least 1. Message `Add at least one item.` Each: product exists and is not archived, `quantity` integer 1 or more (`Enter a whole number of 1 or more.`), `unitCost` integer paisa 0 or more. A product may appear only once: `Each product can appear only once per invoice.`
- `paidNow`: integer paisa from 0 to the computed total: `Amount paid cannot be more than the invoice total.`

Effects, in this order inside the transaction:
1. Compute `total = sum(quantity * unitCost)` on the server. Ignore any total sent by the client.
2. Insert the invoice with `paid_amount = paidNow` and `created_at = nowDbDateTime()`.
3. Insert each item.
4. For each item: `quantity += item.quantity` and `cost = item.unitCost` on the product.
5. Return the `InvoiceDto` (status `PAID` when `paid_amount = total`, otherwise `DUE`).
Any failure rolls back everything. A test must prove the rollback (for example, force the third item to fail and assert no invoice row and unchanged stock).

### 3c. Record payment (SUP-4), one SQLite transaction

Input: `supplierId`, `amount` (paisa, greater than 0).
- Reject `amount <= 0` with `Enter an amount greater than 0.`
- Let `due` be the supplier's total due. Reject `amount > due` with `Payment is more than the balance due (Rs. {formatted due}).` (`RULE`).
- Walk the supplier's unpaid invoices ordered by `invoice_date` ascending, then `id` ascending. For each, add `min(remaining, invoiceDue)` to `paid_amount` and reduce `remaining`; stop at zero.
- Insert a `supplier_payments` row with `paid_at = nowDbDateTime()`.
- Return the refreshed `SupplierDetailDto`.

Worked example (rupees; store as paisa), used as a test:

| invoice | date | total | paid before | due before |
|---|---|---|---|---|
| A | 2026-10-02 | 30,000 | 30,000 | 0 |
| B | 2026-10-12 | 20,000 | 5,000 | 15,000 |
| C | 2026-10-20 | 30,000 | 0 | 30,000 |

Total due 45,000. Paying 20,000 settles B in full (paid 20,000, due 0) and part-pays C (paid 5,000, due 25,000). Total due is now 25,000. Paying 45,001 at the start is rejected.

### 3d. Screen

Match `design/suppliers.png` for layout.

- Header: `Suppliers`, subtitle `Who you buy from, and what you owe`, red `Add supplier` button (opens the supplier form in the right panel).
- Left: search input (`Search supplier or item`), table with Supplier, Supplies, Last order (`formatShort`), Due (`formatTable`, red when above 0, plain when 0), `View` button. Selected row highlighted. Footer row `Total dues` with the sum in monospace.
- Right panel when a supplier is selected: name as title, `Edit` link beside it; Contact, Phone, Address (show `Not provided` in muted text when null); `Balance due` dashed box with `formatCard`; `Invoice history` list, each row showing invoice number (monospace), date (`formatShort`), total, a `PAID` or `DUE` stamp, and an expand control that reveals items (product, quantity, unit cost, line total). Buttons at the bottom: `New invoice` (secondary) and `Record payment` (primary, disabled with title text `Nothing is due` when due is 0).
- `New invoice` opens a form in the right panel: Invoice number, Invoice date (date input, default today), item rows (product select with type-to-filter over non-archived products, Quantity, Unit cost (Rs.) prefilled from the product's current cost, line total), `Add item` button, computed Total (read-only), `Paid now (Rs.)` (default 0), and buttons `Cancel` and `Save invoice`. The product select data comes from `suppliers:productOptions` (already in the contract; implement it in your handler file through the shared products repository), so P3 never depends on P2.
- `Record payment` opens a small dialog with an amount field, hint `Balance due: Rs. {n}`, a `Pay full balance` link that fills the amount, and the exact validation messages above.
- Opening the page with `?supplier=<id>` selects that supplier (the dashboard links here).
- Supplier form fields: Name, Contact name, Phone, Address, Supplies. Delete follows the archive rule with toasts `Supplier deleted.` or `This supplier has invoices, so it was archived instead of deleted.`
- Empty states: no suppliers (`No suppliers yet`, hint `Add a supplier before recording an invoice.`); no invoices for a supplier (`No invoices yet`, hint `Use New invoice when stock arrives.`).
- Mock mode: `src/renderer/dev/mock/suppliers.ts` implements every channel (including `suppliers:productOptions`) with the same rules over in-memory data seeded from the Demo data tables.

### 3e. Seed

`scripts/seed/30-invoices.ts` creates these six invoices through the same repository function the handler uses:

| # | supplier | invoice no | date | state |
|---|---|---|---|---|
| 1 | Koshi Wholesale | `KW-2026-014` | 2026-10-05 | paid in full |
| 2 | Everest Oil Depot | `EOD-0881` | 2026-10-08 | paid in full |
| 3 | Himal Traders | `HT-3302` | 2026-10-12 | half paid |
| 4 | Sagarmatha Stationers | `SS-207` | 2026-10-18 | nothing paid (DUE) |
| 5 | Mechi Household Supplies | `MH-118` | 2026-10-22 | paid in full |
| 6 | Koshi Wholesale | `KW-2026-019` | 2026-10-30 | nothing paid (DUE) |

Items: invoice 1 has Basmati Rice, Lentils, Wheat Flour; 2 has Sunflower Oil; 3 has Tea, Sugar, Salt; 4 has Notebook A4, Ballpoint Pen Pack, Marker Set; 5 has Soap Bar, Detergent Powder; 6 restocks Basmati Rice. Unit cost is each product's cost. Quantities are computed so that, after `scripts/seed/40-sales.ts` (P4) has run, every product's stock equals its `final qty` in the Demo data table. Formula: total received = `final qty` + total sold in `buildSalesPlan(today)`. Split Basmati Rice's total roughly 70/30 between invoices 1 and 6; every other product appears on exactly one invoice.
Because this seed file runs before the sales seed, the stock at the end of this file equals total received; P4's seed then reduces it.
Add a test that runs the plan and the invoice seed and asserts that for every product `received - plannedSold === final qty`.

### 3f. Tests (names start with the ID)

- `SUP-1: creates and edits a supplier; duplicate name is rejected`
- `SUP-1: supplier with invoices is archived, not deleted`
- `SUP-1: supplier with no history is deleted`
- `SUP-2: due is the sum of total minus paid across invoices`
- `SUP-2: last invoice date is the latest invoice date`
- `SUP-2: search matches supplier name and supplies; % and _ are literal`
- `SUP-2: total due equals the sum of the listed suppliers`
- `SUP-3: saves invoice, adds stock, sets cost to the invoice unit cost`
- `SUP-3: total is computed on the server and ignores a client total`
- `SUP-3: duplicate invoice number for the same supplier is rejected; same number for another supplier is accepted`
- `SUP-3: duplicate product lines, zero quantity, empty items and overpaying are rejected with exact messages`
- `SUP-3: failure part-way rolls back invoice, items and stock`
- `SUP-4: payment settles oldest invoices first and part-pays the last` (the worked example)
- `SUP-4: overpayment is rejected with the formatted balance`
- `SUP-4: zero and negative payments are rejected`
- `SUP-4: writes a supplier_payments row`
- `SUP-5: supplier detail returns contact info, due and invoices with items newest first`
- `SEED: received minus planned sold equals final quantity for every product`
- Renderer: row selection loads detail; invoice form computes total live; Record payment shows `Pay full balance`; expand shows items; stamps `PAID` and `DUE` are correct.

### Acceptance checklist (P3)

- [ ] `npm run dev:web` shows Suppliers matching `design/suppliers.png` in layout and visual language.
- [ ] Creating an invoice from the panel updates the supplier's due, last order and the history list immediately.
- [ ] The worked payment example gives exactly the stated results in the app (use the mock data or the seed).
- [ ] Overpaying shows `Payment is more than the balance due (Rs. ...)`.
- [ ] Archived suppliers do not appear in the list or in the product form's supplier select.
- [ ] Empty states appear for no suppliers and for a supplier with no invoices.
- [ ] Layout holds at 1280x900 and 1100x700.
- [ ] `npm run verify` and `npm run build` pass. TRACKER P3 ticked, status `done`, agent log entry added.

---

## Task P4: Sales (SAL-1 to SAL-5)

Depends on P0 and P1. Files you own: `src/main/db/repositories/sales.ts`, `src/main/ipc/sales.ts`, `src/renderer/pages/Sales*` and its components, `src/renderer/dev/mock/sales.ts`, `scripts/seed/40-sales.ts`, tests.

### 4a. Handlers (contract in `src/shared/ipc/sales.ts`; all require a session)

- `sales:picker`: non-archived products for the picker, with `search` (name or code, escaped substring) and `category` filters, plus the category list. Products with quantity 0 are returned (the UI shows them disabled).
- `sales:save`, one SQLite transaction:
  1. Validate `soldAt` with `isValidDateTime` (`Enter a valid date and time.`), at least one line (`Add at least one item.`), each line `quantity` integer 1 or more (`Enter a whole number of 1 or more.`), `unitPrice` integer paisa 0 or more (`Enter an amount of 0 or more, with at most 2 decimals.`).
  2. Merge lines for the same product by summing quantities (use the last line's unit price only when prices match; if they differ keep separate rows but check stock on the sum).
  3. For each product, check the sum requested against current stock. If any product is short, roll back everything and return `RULE` with `Only {n} of {product name} in stock.` (first offending product in line order).
  4. Insert one `sales` row per line with `sold_at = soldAt`, `unit_price = line unitPrice`, `unit_cost = product's current cost`, and decrement stock.
  5. Return `DaySalesDto` for the date part of `soldAt`.
  Archived or unknown products are `NOT_FOUND`.
- `sales:day`: `DaySalesDto` for a date. `total = sum(quantity * unit_price)`, `profit = sum(quantity * (unit_price - unit_cost))` (may be negative), `count` = number of rows, `hourly` = 24 numbers of sales per hour, `rows` ordered by `sold_at` then `id`. Query by range `sold_at >= '{date} 00:00' AND sold_at < '{nextDate} 00:00'` with bound parameters.
- `sales:update`, one transaction: `NOT_FOUND` for an unknown row. Validate like save. `delta = oldQuantity - newQuantity`. Reject when `product.quantity + delta < 0` with `Only {n} of {product name} in stock.` where n is the stock that would be available for this row (`product.quantity + oldQuantity`). Apply the stock change and update `quantity`, `unit_price`, `sold_at`. Never change `unit_cost` or `product_id`.
- `sales:delete`, one transaction: restore `quantity` to the product (also for archived products), delete the row.

### 4b. Screen

Layout (the earlier Billing mock is superseded; use its visual language only): `design/billing.png` for the two-column arrangement, `design/dashboard.png` for the stat cards and chart style.

- Header: `Sales`, subtitle `Record what was sold, and when`.
- Left column: product search (`Search product or code`), category chips (`All` plus categories), product table (Product, Stock, Price, `Add`). Stock below or equal to 0 shows `Out` in red and the `Add` button is disabled. Stock at or below reorder is red.
- Right column, panel `Sale entry`:
  - Top: `When` label with a `datetime-local` input (default now, any value allowed), and a `Now` button that resets it to the current moment. Changing this field immediately changes the date shown in the day panel below.
  - Line items: product name, minus and plus buttons around a typed quantity (minimum 1, plus is capped at current stock), unit price (Rs.) input defaulting to the product's price, line total, and a remove button. Adding a product already in the list increases its quantity instead of adding a second line.
  - Footer: `Total` in large monospace, red `Save sales` button (disabled when no lines). On a `RULE` error show it inline above the button and keep the lines.
  - After a successful save: lines clear, the `When` field keeps its value (so the next sale can be recorded for the same moment), a toast `Saved {n} item(s).`, the product table's stock refreshes, and the day panel refreshes.
- Full-width panel below, title `Sales on {formatLong(date)}` (date = date part of the `When` field):
  - Three stat cards: `Total sales` (`formatCard`), `Profit` (green, red when negative), `Sale rows` (count).
  - `By hour` bar chart with 24 groups (labels `00` to `23`, show every third label on narrow widths).
  - Table of the day's rows: Time (`HH:MM`), Product, Qty, Unit price, Line total, Profit, with `Edit` and `Delete` buttons. Edit opens a small dialog (Quantity, Unit price, When). Delete uses `ConfirmDialog` (`Delete this sale? The stock will be put back.`).
  - Empty state: `No sales on this day`, hint `Pick products above and save to record some.`
- Mock mode: `src/renderer/dev/mock/sales.ts` implements the five channels with the same rules over in-memory data so the demo behaviour (totals changing as dates and times change) can be exercised in the browser.

### 4c. Seed

`scripts/seed/40-sales.ts` inserts every row from `buildSalesPlan(today)` through the repository function used by `sales:save` (so stock decrements exactly like the app). It runs after `30-invoices.ts`. At the end, assert that every product's stock equals its `final qty`; throw if not.

### 4d. Tests (names start with the ID)

- `SAL-1: picker returns non-archived products and filters by search and category`
- `SAL-1: picker returns out-of-stock products`
- `SAL-2: save writes one row per line with the chosen date-time`
- `SAL-2: save snapshots unit price from the line and unit cost from the product`
- `SAL-2: save decrements stock`
- `SAL-2: refuses to sell more than stock and saves nothing`
- `SAL-2: two lines of the same product are checked against the summed quantity`
- `SAL-2: rejects invalid date-time, empty lines, zero quantity`
- `SAL-2: archived product cannot be sold`
- `SAL-3: day totals, profit, count and hourly buckets are correct` (use fixed rows across hours)
- `SAL-3: rows near midnight land on the right day` (`2026-11-03 23:59` and `2026-11-04 00:00`)
- `SAL-3: negative profit is reported as negative`
- `SAL-3: rows are ordered by time`
- `SAL-4: editing quantity applies the stock difference`
- `SAL-4: editing to a quantity above available stock is rejected`
- `SAL-4: editing the date-time moves the row to another day`
- `SAL-4: deleting restores stock exactly once; deleting twice returns NOT_FOUND`
- `SAL-4: edit never changes unit cost or product`
- `SAL-5: changing a product's cost or price later does not change old rows' profit`
- `SEED: final stock equals the target for every product`
- Renderer (jsdom, mock API): `SAL-3: changing the When field changes the day panel date and totals`; `SAL-3: saving a sale updates totals and the hourly chart`; `SAL-1: Add button disabled at zero stock`; `SAL-2: shortage message stays visible and lines are kept`; `SAL-1: Now button resets the field`.

### Acceptance checklist (P4)

- [ ] `npm run dev:web` shows Sales with the picker left, entry panel right and the day panel below, in the visual language of the design files.
- [ ] Record two items at 10:15 on one day and one item at 18:40 on the next day; the day panel shows different totals for each date as the `When` field changes, and the hourly chart shows bars in the right hours.
- [ ] Trying to sell more than the stock shows `Only {n} of {product} in stock.` and saves nothing.
- [ ] Editing and deleting rows updates the totals and stock immediately.
- [ ] Profit shows green for positive and red for negative.
- [ ] Layout holds at 1280x900 and 1100x700.
- [ ] `npm run verify` and `npm run build` pass. TRACKER P4 ticked, status `done`, agent log entry added.

---

## Task P5: Dashboard and reports (DASH-1 to DASH-5, REP-1 to REP-7)

Depends on P2, P3 and P4 (read their repositories; do not edit them). Files you own: `src/main/domain/reports.ts`, `src/main/db/repositories/reports.ts`, `src/main/ipc/reports.ts`, `src/renderer/pages/Dashboard*`, `src/renderer/pages/Reports*` and their components, `src/renderer/dev/mock/reports.ts`, tests.

### 5a. Pure aggregation functions (`src/main/domain/reports.ts`, no database access)

```ts
export interface SaleFact {
  soldAt: string; productId: number; productName: string;
  quantity: number; unitPrice: number; unitCost: number;
}
```
- `sumSales(rows)`, `sumCost(rows)`, `sumProfit(rows)`: integer paisa (`quantity * unitPrice`, `quantity * unitCost`, difference).
- `bucketByDay(rows, from, to): DayBucketDto[]`: one bucket per day from `from` to `to` inclusive, zero-filled.
- `bucketByHour(rows): number[]`: 24 entries of sales.
- `weekBars(rows, date): WeekBarDto[]`: 7 entries Sunday to Saturday for the week containing `date`, labels `Sun` to `Sat`.
- `topProducts(rows, limit = 5)`: grouped by product; `sold` = quantity sum; ordered by sales descending, then name.
- `stockValuation(products)`: sum of `quantity * cost`.
- `resolveRange(preset: 'today' | 'week' | 'month', today)` returns `{ from, to }` (Sunday to Saturday for week; first to last day for month).
- `toCsv(headers: string[], rows: (string | number)[][]): string`: UTF-8 BOM first, `\r\n` line endings, quotes around fields containing a comma, quote, CR or LF, quotes doubled.

Repository functions fetch `SaleFact` rows for a range with `sold_at >= ? AND sold_at < ?` (bound parameters), and the other raw data the handlers need.

### 5b. Handlers (contract in `src/shared/ipc/reports.ts`; all require a session)

- `dashboard:get({ date })`:
  - `sales`, `profit` for that date. `isToday` is true when `date` equals today.
  - `lowStockCount`: non-archived products with `quantity <= reorder_level` (includes out of stock).
  - `supplierDue`: total due across non-archived suppliers.
  - `week`: `weekBars` for the week containing `date`.
  - `restock`: up to 4 non-archived products with `quantity <= reorder_level`, lowest quantity first, then name.
  - `recentInvoices`: the last 4 supplier invoices by `created_at` descending then `id` descending.
- `reports:get({ tab, from, to })`: validate `from` and `to` as dates (`Enter a valid date.`), `from <= to` (`Start date must be on or before the end date.`), range at most 366 days (`Choose a range of 366 days or less.`). Returns the DTO for the tab as defined in the contract. `SalesReportDto.byHour` is non-null only when `from === to`. `stock` and `dues` ignore the range. Voided concepts do not exist; every sale row counts.
- `reports:exportCsv({ tab, from, to })`: shows the Electron save dialog (default file name `stockbill-{tab}-{from}-to-{to}.csv`, or `stockbill-{tab}.csv` for stock and dues), writes the file, returns `{ saved, path }`. Cancelling returns `{ saved: false, path: null }`. Build the CSV text in a pure function so it is testable without Electron. Money columns are rupees with two decimals and no grouping (`1150.50`). One table per tab:
  - sales: `Date,Sale rows,Sales,Profit` per day.
  - profit: `Date,Sales,Cost of goods,Gross profit` per day.
  - stock: `Product,Category,Quantity,Reorder at,Cost,Stock value,Status` for every non-archived product.
  - dues: `Supplier,Due` for every supplier with a due above 0, then a final `Total` row.

### 5c. Dashboard screen

Match `design/dashboard.png`.

- Header: `Dashboard`, subtitle shows `formatLong(date)`. On the right a date input (default today, any date allowed) and the red `New sale` button linking to `/sales`.
- Four stat cards in this order: Sales (label `TODAY'S SALES` when `isToday`, otherwise `SALES ON {formatShort(date)}`), Profit (label `TODAY'S PROFIT` or `PROFIT ON ...`, green when 0 or above, red when negative), `LOW-STOCK ITEMS` (red count), `SUPPLIER DUES`.
- `Sales this week` bar chart (7 ink bars); the selected date's label is bold.
- `Needs restock` list: name and `{n} left` in red (`0 left` for out of stock); each row links to `/inventory?product={id}`. Empty state `Nothing needs restocking`.
- `Recent supplier invoices` table: Invoice no. (monospace), Supplier, Amount (Rs.), Status stamp; each row links to `/suppliers?supplier={supplierId}`. Empty state `No supplier invoices yet`.
- Mock mode: `src/renderer/dev/mock/reports.ts` computes from the other mock modules' in-memory data so the demo behaviour matches.

### 5d. Reports screen

Match `design/reports.png`.

- Header: `Reports`, subtitle `Sales and profit for the period you choose`, `Export CSV` (secondary) and `Print report` (primary, calls `window.print()`).
- Tabs row: `Sales`, `Profit`, `Stock`, `Supplier dues` (selected tab is solid ink). Range chips on the right: `Today`, `This week`, `This month`, `Custom` (selected is solid ink). Choosing `Custom` shows From and To date inputs. Default tab `Profit` and range `This week`. For the `Stock` and `Supplier dues` tabs the range chips are disabled and a muted note reads `Current figures`.
- Sales tab: cards `Total sales`, `Sale rows`; by-day bar chart (single ink series) with a table (Date, Sale rows, Sales, Profit); when `from === to` also an `By hour` chart.
- Profit tab: cards `Total sales`, `Cost of goods`, `Gross profit` (green or red), `Sale rows`; paired bars by day (ink for sales, green for profit) with a legend; `Top selling products` table (Product, Sold, Sales, Profit).
- Stock tab: cards `Stock value`, `Products`, `Low or out of stock`; table of low and out products (Product, Qty, Reorder at, Status stamp); note `Stock value uses each product's current cost.`
- Supplier dues tab: cards `Total due`, `Suppliers owed`; table (Supplier, Due) with a total row.
- Print: `print.css` hides the navigation, buttons, chips and inputs; a print-only line shows `Report: {tab} · {from} to {to}` and the shop name. Black on white, charts keep their fills (use `print-color-adjust: exact`).
- Chart labels for ranges over 31 days show only the first of each week.
- Empty state for a range with no sales: `No sales in this period`.

### 5e. Tests (names start with the ID)

- `DASH-1: sales and profit are for the selected date only`
- `DASH-1: low-stock count includes out-of-stock products and excludes archived ones`
- `DASH-1: supplier due matches the suppliers list`
- `DASH-2: week bars run Sunday to Saturday for the week containing the date` (`2026-11-03` gives `2026-11-01` to `2026-11-07`; a Sunday date and a Saturday date both stay in their own week)
- `DASH-2: days with no sales are zero`
- `DASH-3: restock list is limited to 4 and ordered by quantity then name`
- `DASH-4: recent invoices are the last 4 by creation`
- `DASH-5: New sale button links to /sales` (renderer)
- `REP-1: resolveRange for today, week and month` (include a month with 28, 30 and 31 days and a leap year)
- `REP-1: rejects reversed ranges, invalid dates and ranges over 366 days`
- `REP-2: by-day buckets are zero-filled and by-hour appears only for a single day`
- `REP-3: gross profit equals sales minus cost of goods` (worked example below)
- `REP-3: top products are ordered by sales, ties by name, limited to 5`
- `REP-4: stock valuation is the sum of quantity times cost; low list includes OUT`
- `REP-5: dues report lists only suppliers owed and totals correctly`
- `REP-6: CSV has a BOM, CRLF endings and escapes commas, quotes and newlines`
- `REP-6: sales, profit, stock and dues CSV have the headers above`
- `REP-7: print stylesheet hides navigation and controls` (read `print.css` in the test and assert the rules exist)
- Renderer: tab switching, range chip switching, disabled range chips on stock and dues, `Custom` shows date inputs.

Worked example for `REP-3` (rupees, stored as paisa): three rows on one day: 4 x price 100 cost 60; 2 x price 250 cost 200; 1 x price 90 cost 100. Sales 400 + 500 + 90 = 990. Cost 240 + 400 + 100 = 740. Gross profit 250 (the third row contributes -10).

### Acceptance checklist (P5)

- [ ] `npm run dev:web` shows Dashboard and Reports matching `design/dashboard.png` and `design/reports.png` in layout and visual language.
- [ ] Changing the dashboard date changes the cards, labels (`TODAY'S SALES` only for today) and the highlighted week label.
- [ ] Restock rows and invoice rows navigate to the right pages with the right item selected.
- [ ] Every report tab and every range preset renders; `Custom` validates its dates with the exact messages.
- [ ] Export CSV writes a file that opens correctly in a spreadsheet with proper columns (verify the pure CSV output; verify the dialog flow in the real app if the environment supports it, otherwise state that in the PR).
- [ ] Print preview hides navigation and controls.
- [ ] Layout holds at 1280x900 and 1100x700.
- [ ] `npm run verify` and `npm run build` pass. TRACKER P5 ticked, status `done`, agent log entry added.

---

## Task P6: Documentation, polish and demo readiness

Depends on P5. Files you own: everything under `docs/` except `SPEC.md`, `TRACKER.md`, `schema.sql` regeneration rules in this task, README, `scripts/trace.ts`, `tests/docs.test.ts`, and small UI fixes found during polish.

### 6a. Documents (Mermaid diagrams; render-check each block by reading it carefully, because the examiner reads them on GitHub)

- `docs/er-diagram.md`: `erDiagram` with all eight tables, their columns with types and key markers, and relationships (users has no relations; suppliers 1 to many products, 1 to many supplier_invoices, 1 to many supplier_payments; supplier_invoices 1 to many supplier_invoice_items; products 1 to many sales and 1 to many supplier_invoice_items). Add a short paragraph that explains money in paisa and the date-time text format.
- `docs/schema.sql`: must equal the schema produced by running the migrations. Add `tests/docs.test.ts` with `DOCS: schema.sql matches the migrated database` (open an in-memory database, read `sqlite_master`, compare table and index names and column lists with the parsed `schema.sql`).
- `docs/use-case.md`: a Mermaid `flowchart LR` showing one actor `Shop owner` linked to rounded use-case nodes: Set up shop (AUTH-1), Sign in (AUTH-2), Manage products (INV-1 to INV-5), Manage suppliers (SUP-1, SUP-2, SUP-5), Record supplier invoice (SUP-3), Record supplier payment (SUP-4), Record sales (SAL-1, SAL-2), Review and correct sales (SAL-3, SAL-4), View dashboard (DASH-1 to DASH-5), View reports (REP-1 to REP-5), Export and print reports (REP-6, REP-7). Add a note that Mermaid has no native use-case notation so this flowchart follows the standard layout.
- `docs/architecture.md`: Mermaid `flowchart TB` with subgraphs Renderer (React pages, components, `window.api`), Preload (contextBridge), Main process (IPC handlers with zod and session check, Domain functions, Repositories with prepared statements), and the SQLite file in the user data folder. Mark the trust boundary between Renderer and Main. Add paragraphs on security (parameterized SQL, bcrypt, context isolation, input validation) and on testing (what is unit tested where).
- `docs/requirements-trace.md`: generated by `npm run trace` (add the script: `tsx scripts/trace.ts`). The script reads every requirement ID from `docs/SPEC.md` (pattern `**ABC-1**`), scans test files for test names starting with that ID, and writes a table: ID, requirement text (first sentence), test files, screen. Add `tests/docs.test.ts` case `DOCS: every requirement ID in SPEC.md has at least one test whose name starts with it` (exclude `REL-1`, `REL-2`, `REL-3`, `REL-5`, `REL-7`, which are verified by the pipeline and documents, not unit tests).
- `docs/gantt.md`: a Mermaid `gantt` with `dateFormat YYYY-MM-DD` and `axisFormat %d %b`, title `StockBill project timeline`, with this fixed schedule:

| section | task | start | length |
|---|---|---|---|
| Foundation | P0 Foundation | 2026-11-04 | 1d |
| Core | P1 Authentication | 2026-11-05 | 1d |
| Core | P7 Release pipeline | 2026-11-05 | 1d |
| Features | P2 Inventory | 2026-11-06 | 2d |
| Features | P3 Suppliers and invoices | 2026-11-06 | 2d |
| Features | P4 Sales | 2026-11-06 | 2d |
| Insights | P5 Dashboard and reports | 2026-11-08 | 2d |
| Finish | P6 Documentation and polish | 2026-11-10 | 2d |
| Finish | Viva rehearsal and buffer | 2026-11-12 | 2d |

- `docs/demo-script.md`: a numbered walkthrough for the viva, in plain English, using the seed data (`npm run seed:demo`, then start the app with `STOCKBILL_DB` pointing at the demo file): 1 sign in as `admin`; 2 dashboard overview; 3 inventory: search, low stock filter, edit a product; 4 supplier: open Himal Traders, show due, record a payment; 5 new supplier invoice that restocks Salt, show stock rise; 6 sales: record two items at 10:15 today, then one item at 18:40 yesterday, point out the day panel and hourly chart changing with the `When` field; 7 try to oversell and show the refusal; 8 edit and delete a sale and show stock return; 9 dashboard and reports reflect the new data; 10 export CSV and print preview. Each step has one line on which requirement ID it demonstrates.

### 6b. Polish (fix in code; record each fix in the agent log)

- Every screen has designed empty, loading and error states; no raw exception text or empty white panel anywhere.
- Every failed IPC call shows a toast with the error's `message`; `INTERNAL` shows the generic message.
- Every destructive action goes through `ConfirmDialog`.
- Keyboard: tab order follows visual order, forms submit with Enter, dialogs close with Escape, focus returns to the control that opened a dialog.
- Terminology is consistent: `Sale rows`, `Supplier invoice`, `Due`, `Reorder at`, `Stock`.
- No `console.log` left in the renderer or main (errors in the IPC wrapper use `console.error`).
- Verify all seven screens at 1280x900 and 1100x700 in `npm run dev:web` (or the real app if available): no horizontal scroll, no overlapping text, tables keep readable columns.
- `npm run seed:demo` then the app: every dashboard card, chart and report tab shows data. Add test `SEED: every dashboard and report view has data for today` that runs the full seed in `:memory:` and calls the repository functions behind `dashboard:get` and `reports:get` for each tab with a range covering the last 10 days.

### 6c. README final

Add: feature list by screen, screenshots section (only if screenshots can be generated; otherwise omit the section), how to run the demo, how to run tests, the project layout, requirement tracing (`npm run trace`), and a short `Security` section (parameterized SQL only, bcrypt, no ORM, context isolation).

### Acceptance checklist (P6)

- [ ] All five diagrams render on GitHub (Mermaid syntax valid; no unclosed blocks).
- [ ] `npm run trace` regenerates `docs/requirements-trace.md` with a test file for every listed ID.
- [ ] `tests/docs.test.ts` passes.
- [ ] Every item in 6b is done or explained in the PR description.
- [ ] `npm run verify` and `npm run build` pass. TRACKER P6 ticked, status `done`, agent log entry added.

---

## Task P7: Release pipeline (REL-1 to REL-7)

Depends on P0 and P1. Files you own: `.github/**`, `electron-builder.yml`, `tests/release-config.test.ts`, `docs/release-process.md`, the README `Download` section.

`.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/pull_request_template.md` and `electron-builder.yml` already exist. This task proves they work with the real project and documents them.

### 7a. Tests

`tests/release-config.test.ts`:
- `REL-6: every npm script used in the workflows exists in package.json` (read `.github/workflows/*.yml`, extract `npm run <name>` with a regular expression, assert each name is a key in `package.json` scripts).
- `REL-6: electron-builder.yml exists and unpacks native modules` (assert the file exists and contains `asarUnpack`).
- `REL-2: package.json version is 0.0.0` (the pipeline stamps the version at build time).
- `REL-3: artifact name pattern matches StockBill-<version>-<os>-<arch>.<ext>`.

### 7b. Local packaging proof

Run `npm run dist` in your environment. Confirm that an installer file appears in `dist/` and that it follows the naming pattern. Start the packaged app if your environment allows it and confirm it creates `stockbill.db` under the user data folder and applies the migrations (this proves migrations are bundled). If packaging fails, fix the cause in `electron-builder.yml` or the application code, not by weakening a test. If `dist` cannot run in your environment at all, say so in the PR and run `npm run build` plus `npx electron-builder --dir` instead, and state which part could not be verified.

### 7c. Workflow review

Read both workflows against the real `package.json`. Fix any step that cannot succeed (wrong script name, missing file, wrong output directory) while keeping the structure: `verify`, `version`, `build` matrix (Windows, Linux, macOS, `fail-fast: false`), `release`. Record each change in the agent log. Do not change the Node version, the action versions, the tag prefix or the paths-ignore list without a failing reason you can state.

### 7d. Documentation

- README `Download` section (REL-5): link to the repository's Releases page; describe the installers per platform; explain the unsigned warning (Windows: `More info`, then `Run anyway`; macOS: right-click the app, `Open`); show the release workflow badge.
- `docs/release-process.md` (REL-7): Mermaid `flowchart TD` from pull request, through `CI` (verify on Ubuntu and Windows), merge to `main`, `verify`, `version` (Conventional Commits decide the next number), `build` on three systems, to `release` with attached installers. Add a table of commit types and the version bump each causes, and a paragraph on why the repository never commits a version bump.

### Acceptance checklist (P7)

- [ ] `tests/release-config.test.ts` passes.
- [ ] `npm run dist` produced a correctly named installer, or the PR states exactly what could not be verified and why.
- [ ] Both workflows still parse as YAML and reference only existing scripts.
- [ ] README `Download` section and `docs/release-process.md` exist; the Mermaid block is valid.
- [ ] `npm run verify` passes. TRACKER P7 ticked, status `done`, agent log entry added.

---

## Noticed during review. Do NOT change in any run; list the relevant ones in the PR description

1. Installers are unsigned, so Windows SmartScreen and macOS Gatekeeper show a warning.
2. The macOS installer is arm64 only.
3. The unit price on a sale line is editable, so a sale below cost is possible; only the Inventory screen warns about price below cost.
4. Date-times are stored as local-time text; moving the computer to another time zone does not shift stored values.
5. One owner account only; there is no password recovery. Forgetting the password means deleting the database file.
6. There is no backup or restore. Data lives in one SQLite file in the user data folder.
7. Dashboard and reports include every sale row; there is no void or return concept, only edit and delete.

## Definition of done for this run

The acceptance checklist of your task is fully ticked or each unticked box is explained. `npm run verify` passes. The tracker is updated. One PR is open with the four-part description. You stopped without starting another phase.
