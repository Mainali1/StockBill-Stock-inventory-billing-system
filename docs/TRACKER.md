# StockBill tracker

Agents: work only on the phase you are assigned. Tick tasks when their tests pass. Update the Status column, and append to the agent log. Do not edit other phases' task lists except to tick completed items.

## Status

| Phase | Name | Depends on | Status |
|---|---|---|---|
| P0 | Foundation | none | not started |
| P1 | Authentication | P0 | not started |
| P2 | Inventory | P0, P1 | not started |
| P3 | Suppliers and supplier invoices | P0, P1 | not started |
| P4 | Sales | P0, P1 | not started |
| P5 | Dashboard and reports | P2, P3, P4 | not started |
| P6 | Documentation, polish, demo readiness | P5 | not started |

P2, P3 and P4 are independent of each other and may run in parallel. They must not edit each other's files. Shared files (router, nav, tokens, shared components) are finished in P0 so these phases only add feature files.

## P0 Foundation
- [ ] electron-vite project, TypeScript strict, ESLint, Prettier, Vitest, `npm run verify`
- [ ] `rebuild:node` / `rebuild:electron` scripts; tests rebuild for Node automatically
- [ ] Local fonts, `tokens.css`, `base.css`, `print.css`
- [ ] Shared components: PageFrame, NavBar, PageHeader, Stamp, StatCard, DataTable, Button, Chip, Field, BarChart (CSS bars, supports paired series and the corner-triangle style)
- [ ] Router with all routes registered (Setup, Login, Dashboard, Sales, Inventory, Suppliers, Reports) rendering placeholder pages inside the frame; route guard redirects based on session state
- [ ] Preload bridge and IPC pattern (zod validation, session check helper) with one example handler and test
- [ ] Migrations for every table in SPEC section 1; `docs/schema.sql` generated or mirrored
- [ ] Domain helpers with tests: money (rupees to paisa, formatting en-IN), date helpers (day, hour, Sunday-start week, month range), product status
- [ ] Shared repositories: products (get by id, list, change stock with non-negative guard)
- [ ] `seed:demo` script per SPEC section 4 (may be completed after P1 for the user row)
- [ ] README: install, rebuild scripts, dev, test, seed

## P1 Authentication (AUTH-1 to AUTH-5)
- [ ] Setup, login, logout, session, lockout in main process with tests
- [ ] bcrypt hashing test and injection tests
- [ ] Setup and Login screens in the visual language

## P2 Inventory (INV-1 to INV-5)
- [ ] Repository and IPC with tests
- [ ] Inventory screen: list, search, chips, edit panel, add, delete/archive, status stamps, price warning

## P3 Suppliers and supplier invoices (SUP-1 to SUP-5)
- [ ] Repositories and IPC with tests (invoice save, payment allocation, due calculation)
- [ ] Suppliers screen: list, detail panel, add and edit supplier, New invoice flow, Record payment flow, expandable history

## P4 Sales (SAL-1 to SAL-5)
- [ ] Repository and IPC with tests (save, oversell refusal, edit, delete, snapshots)
- [ ] Sales screen: picker, entry panel with date-time field, Sales on date panel with hourly chart, edit and delete rows
- [ ] Screen test (jsdom): changing the date-time field changes the day panel; saving a sale updates totals

## P5 Dashboard and reports (DASH-1 to DASH-5, REP-1 to REP-7)
- [ ] Aggregation functions in `domain` with tests (by day, by hour, week range, top products, valuation)
- [ ] Dashboard screen
- [ ] Reports screen with four tabs, ranges, CSV export, print CSS

## P6 Documentation, polish, demo readiness
- [ ] `docs/er-diagram.md`, `docs/use-case.md`, `docs/architecture.md`, `docs/requirements-trace.md`
- [ ] Empty states, error messages and confirmations on every screen
- [ ] Verify at 1280x900 and 1100x700
- [ ] Final `seed:demo` produces data that makes every dashboard and report view non-empty
- [ ] README final

## Agent log
(append one entry per task: date, phase, what was built, decisions, ambiguities)
