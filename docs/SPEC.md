# StockBill specification

Scope: single-shop, single-account, offline desktop stock-keeping. Requirement IDs below are referenced by tests, commits and the tracker.

## 1. Data model

All money columns are INTEGER paisa. All `*_at`/`*_date` text columns follow the formats in AGENTS.md. Foreign keys are enforced (`PRAGMA foreign_keys = ON`). Provide the schema as numbered migrations and mirror it in `docs/schema.sql`.

| Table | Columns and constraints |
|---|---|
| `users` | id PK, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL |
| `settings` | key TEXT PK, value TEXT NOT NULL. Keys: `shop_name` |
| `suppliers` | id PK, name TEXT UNIQUE NOT NULL, contact_name TEXT, phone TEXT, address TEXT, supplies TEXT, archived INTEGER NOT NULL DEFAULT 0 |
| `products` | id PK, name TEXT NOT NULL, code TEXT UNIQUE NULL, category TEXT NOT NULL, supplier_id INTEGER NULL FK suppliers, cost INTEGER NOT NULL CHECK(cost>=0), price INTEGER NOT NULL CHECK(price>=0), quantity INTEGER NOT NULL CHECK(quantity>=0), reorder_level INTEGER NOT NULL CHECK(reorder_level>=0), archived INTEGER NOT NULL DEFAULT 0 |
| `sales` | id PK, product_id FK products NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), unit_price INTEGER NOT NULL, unit_cost INTEGER NOT NULL, sold_at TEXT NOT NULL |
| `supplier_invoices` | id PK, supplier_id FK NOT NULL, invoice_no TEXT NOT NULL, invoice_date TEXT NOT NULL (date only), total INTEGER NOT NULL, paid_amount INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, UNIQUE(supplier_id, invoice_no), CHECK(paid_amount<=total) |
| `supplier_invoice_items` | id PK, invoice_id FK NOT NULL, product_id FK NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), unit_cost INTEGER NOT NULL |
| `supplier_payments` | id PK, supplier_id FK NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), paid_at TEXT NOT NULL |

Indexes: `sales(sold_at)`, `sales(product_id)`, `products(name)`, `supplier_invoices(supplier_id, invoice_date)`.

Derived values (never stored): product status, supplier due, invoice status (PAID when paid_amount = total, else DUE).

## 2. Requirements

### Authentication
- **AUTH-1** On first launch (no user row) the app shows Setup: shop name, username, password (min 8 characters), confirm password. It creates the only user, stores `shop_name`, and signs in. Setup is unreachable once a user exists.
- **AUTH-2** Login takes username and password. Failure shows one generic message. After 5 consecutive failures the form is locked for 30 seconds (state kept in the main process).
- **AUTH-3** A session lives in the main process. Logout clears it. Every IPC handler except setup-status, setup and login rejects calls without a session.
- **AUTH-4** Passwords are stored only as bcrypt hashes. No handler returns a hash or password.
- **AUTH-5** Injection payloads in username or password never authenticate and never change data.

### Inventory
- **INV-1** List products (not archived) with search by name or code (case-insensitive, substring), category chips derived from data, and a "Low stock only" chip.
- **INV-2** Create and edit a product: name required; code optional but unique; category required (free text, suggest existing ones); supplier optional; cost, price, quantity, reorder level are non-negative integers or decimals as appropriate (money in rupees with up to 2 decimals, quantities whole numbers). Validation errors show inline.
- **INV-3** Status: OUT when quantity = 0; LOW when 0 < quantity <= reorder_level; otherwise IN STOCK.
- **INV-4** Delete: if the product has any sales or supplier invoice items, it is archived instead and the user is told; otherwise it is removed. Archived products never appear in lists or pickers.
- **INV-5** Saving a price lower than cost shows a non-blocking warning.

### Suppliers and supplier invoices
- **SUP-1** Create and edit suppliers (name required and unique). Archive instead of delete when invoices exist.
- **SUP-2** Supplier list shows name, supplies, last invoice date, and due (sum of total minus paid_amount over its invoices). A footer shows total dues across suppliers. Search by supplier name or supplies text.
- **SUP-3** Create a supplier invoice: supplier, supplier's own invoice number (typed, required, unique per supplier), invoice date, at least one item (product, whole quantity > 0, unit cost >= 0), and an optional amount paid now (0 to total). Total is computed from the items. In one transaction: insert the invoice and items, add each quantity to the product's stock, set each product's cost to that item's unit cost, and set paid_amount.
- **SUP-4** Record a payment against a supplier: amount > 0 and <= its total due. It is applied to the oldest unpaid invoices first (by invoice_date, then id), possibly part-paying the last one, and a `supplier_payments` row is written, all in one transaction.
- **SUP-5** The supplier detail panel shows contact info, balance due, and invoice history (invoice number, date, total, PAID/DUE stamp) where each row expands to its items.

### Sales
- **SAL-1** The Sales screen has a date-time field (HTML `datetime-local`, local time) that defaults to the current moment and can be set to any past or future moment. Product picker with search by name or code and category chips. Adding a product creates an entry line with quantity (default 1, adjustable with minus/plus and typing) and unit price (defaults to the product price, editable).
- **SAL-2** "Save sales" writes one `sales` row per line using the chosen date-time, snapshotting `unit_price` and the product's current `cost` as `unit_cost`, and decrements stock, in one transaction. A line whose quantity exceeds available stock is rejected with a clear message and nothing is saved.
- **SAL-3** A "Sales on <date>" panel always reflects the date part of the date-time field: total sales, profit, number of sale rows, an hour-by-hour bar chart (00 to 23), and the day's rows sorted by time. It refreshes immediately after a save and when the date changes. This is the viva demonstration of totals changing as sales occur at different times and days.
- **SAL-4** Rows in that panel can be edited (quantity, unit price, date-time) or deleted. Delete restores stock; edit applies the stock difference. Both are transactional and refuse results that would make stock negative.
- **SAL-5** Profit of a row is quantity x (unit_price - unit_cost) from the snapshots; later cost or price changes never change old rows.

### Dashboard
- **DASH-1** A date field (default today, any date allowed) controls the cards and chart. Cards: Sales on that date, Profit on that date, Low-stock items (count of products with quantity <= reorder_level and not archived), Supplier dues.
- **DASH-2** "Sales this week": Sunday to Saturday bars for the week containing the selected date.
- **DASH-3** "Needs restock": up to 4 lowest-quantity products at or below reorder level, with `N left` in red; clicking one opens it in Inventory.
- **DASH-4** "Recent supplier invoices": last 4 by creation, with number, supplier, amount, PAID/DUE stamp.
- **DASH-5** A "New sale" button goes to Sales.

### Reports
- **REP-1** Tabs: Sales, Profit, Stock, Supplier dues. Range chips: Today, This week, This month, Custom (from and to dates, inclusive). Ranges are relative to the real current date.
- **REP-2** Sales tab: total sales, number of sale rows, by-day bar chart and table. When the range is a single day, also an hour-by-hour chart.
- **REP-3** Profit tab: total sales, cost of goods, gross profit, sale rows; paired sales/profit bars by day; top selling products (sold quantity, sales, profit).
- **REP-4** Stock tab: stock valuation (sum quantity x cost), product count, and the low-stock list.
- **REP-5** Supplier dues tab: due per supplier and the total.
- **REP-6** Export CSV for the tab and range shown. Escape commas, quotes and newlines properly.
- **REP-7** Print report uses print CSS: hide nav and controls, black on white.

## 3. Screens and visual language

Navigation: Dashboard, Sales, Inventory, Suppliers, Reports. Right side of the bar shows the username and a Sign out button. Setup and Login are centered cards on the page background.

Palette (sample exact values from `design/`; these are approximations):
`--bg-center #ead9b0`, `--bg-edge #d3b98a` (radial page gradient), `--paper #f3e8cd`, `--paper-hi #fbf4e1`, `--ink #3b2a1a`, `--ink-soft #6b5a45`, `--rule #d9c49a`, `--red #8e2418`, `--green #2c5233`.

Rules:
- Zero border radius everywhere. 1px ink borders on inputs and secondary buttons. The main page frame has a 2px ink border and a soft shadow, about 32px from the window edge.
- Titles in Fraunces bold about 34px with a muted subtitle and a 1px ink rule below. UI text in Inter. All money, quantities and numbers in Courier Prime, right-aligned in tables. Field labels small uppercase letter-spaced `--ink-soft`.
- Stat cards: `--paper-hi`, 1px dashed border, small uppercase label, large monospace value.
- Stamp component: small uppercase bold text, 1px colored border, slight deterministic rotation. PAID, IN STOCK green; DUE, LOW, OUT red.
- Buttons: primary solid red with cream text; secondary transparent with ink border; selected chip solid ink with cream text; destructive secondary red text and border.
- Bars: solid ink-brown with a small cream triangle in the bottom-left corner; profit bars green.
- Tables: small uppercase muted headers, 1px `--rule` row dividers, no zebra.
- Layouts: Inventory and Suppliers are a list on the left with a detail/edit panel on the right. Sales is a product picker on the left and the entry panel on the right (date-time field at the top of the entry panel, line items with minus/plus, total, red Save sales button), with the full-width "Sales on <date>" panel beneath. Dashboard is four stat cards, then chart and restock list side by side, then recent invoices.
- Window design target 1280x900, minimum 1100x700.
- Every list has an empty state. Every IPC failure shows an inline or toast message. Destructive actions ask for confirmation.

## 4. Demo seed

`npm run seed:demo` creates a fresh database containing: user `admin` / `admin12345` with shop name "Demo Mart"; about 12 products across at least 3 categories with at least 2 LOW and 1 OUT; 5 suppliers; 6 supplier invoices (some DUE, some PAID, one partly paid); and sales rows for each of the last 10 days relative to the run date, spread across different hours with different volumes per day so charts show variation. Deterministic (fixed pseudo-random seed). The seed uses the same repositories or SQL as the app so stock numbers are consistent with the sales and invoices it creates.

## 5. Documentation deliverables

Maintained under `docs/` and kept consistent with the migrations: `schema.sql`; `er-diagram.md` (Mermaid `erDiagram`); `use-case.md` (Mermaid diagram of the owner's use cases mapped to requirement IDs); `architecture.md` (Mermaid diagram of renderer, preload, IPC, main, domain, SQLite); `requirements-trace.md` (table mapping each requirement ID to its test file and screen).
