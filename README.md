# StockBill

StockBill is an offline desktop stock-keeping manager for a single shop. The owner keeps a product
list with cost, price, quantity and reorder level; records invoices received from suppliers (which
add stock and create amounts owed); records what was sold, per item, at a chosen date and time
(which removes stock); and reads a dashboard and reports for any day or range. There are no
customers, no payment methods, no tax and no receipts. It is one offline program with a single owner
account.

## Requirements

- Node 22 (`>=22`) and npm. The version is pinned in `.nvmrc`.

## Install

```
npm ci
```

`npm ci` installs exactly the versions in `package-lock.json`.

## Run

```
npm run dev
```

This rebuilds the native SQLite module for Electron and opens the desktop window.

To run the renderer in a normal browser with an in-memory mock API (no Electron):

```
npm run dev:web
```

The URL query string picks the mock auth state: `?state=setup`, `?state=login` or the default
signed-in state.

## Test

```
npm test
```

This rebuilds the native module for plain Node and runs the Vitest suite in two projects: `main`
(Node) for the database, IPC and shared code, and `renderer` (jsdom) for the React screens.

## Native module note

`better-sqlite3` is a native module that must be built for either plain Node or Electron.

- `npm run rebuild:node` builds it for plain Node. Tests and the seed script need this.
- `npm run rebuild:electron` builds it for Electron. The desktop app needs this.

`npm run dev` runs `rebuild:electron` first, and `npm test` and `npm run seed:demo` run
`rebuild:node` first, so the right build is always in place. Run them again if you switch between
the app and the tests by hand.

## Seed demo data

```
npm run seed:demo
```

This recreates a demo database (default `./demo/stockbill-demo.db`) with a demo user, suppliers,
products, invoices and sales. Point the app at it with the `STOCKBILL_DB` environment variable,
which overrides the default database path (used by the seed and tests only).

## Project layout

```
src/main/        Electron main process
  db/            connection, numbered SQL migrations, repositories
  domain/        pure functions and errors
  ipc/           one file per feature; each handler validates input and checks the session
  index.ts
src/preload/     typed contextBridge API
src/renderer/    React app (pages/, components/, styles/, dev/ mock layer)
src/shared/      DTO types and IPC channel names shared by main and renderer
scripts/         seed runner and one-off scripts
tests/           repository-level tests
docs/            SPEC.md, TRACKER.md, schema.sql
```

## Scripts

| Script | What it does |
|---|---|
| `dev` | Rebuild for Electron, then run the desktop app |
| `dev:web` | Vite dev server for the renderer only, with the mock API |
| `build` | Build main, preload and renderer into `out/` |
| `dist` | Build, then package installers with electron-builder into `dist/` |
| `typecheck` | `tsc --noEmit` for every tsconfig project |
| `lint` | Run ESLint over the repository |
| `format` | Run Prettier over the repository |
| `test` | Rebuild for Node, then run Vitest |
| `verify` | `typecheck`, then `lint`, then `test` |
| `rebuild:node` | Rebuild `better-sqlite3` for plain Node |
| `rebuild:electron` | Rebuild `better-sqlite3` for Electron |
| `seed:demo` | Recreate the demo database |
| `schema:dump` | Regenerate `docs/schema.sql` from the migrations |
