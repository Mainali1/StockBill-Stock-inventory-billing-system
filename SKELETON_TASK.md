# Task: StockBill skeleton (plumbing only, no features)

## Goal
Produce a working, empty application frame: dependencies installed, every config file in place, folder layout created, database connection and migrations working, the IPC contract and wrapper in place, and a router that shows placeholder pages inside a styled frame. A later agent builds all features on top of this frame and is forbidden to change dependencies or configuration, so this task must get them right.

Implement no feature logic: no products, suppliers, sales, reports or authentication logic. No shared UI kit beyond the three shell components listed in S9.

## Rules
- Read, in this order: `AGENTS.md`, `docs/SPEC.md`, `docs/TRACKER.md`, then `JULES_TASK.md` sections "Shared reference" and "Task P0" (sections 0a, 0b, 0c, 0e, 0g). Where this file and `JULES_TASK.md` differ, this file wins.
- Work on a new branch `chore/skeleton`. Never commit to `main`. Commit messages are Conventional Commits: `chore(skeleton): ...`, `test(skeleton): ...`, `build(skeleton): ...`.
- The developer machine is Windows with PowerShell. Every npm script and every command you add must work on Windows, Linux and macOS. No bash-only syntax in scripts.
- Do not edit `AGENTS.md`, `docs/SPEC.md`, `JULES_TASK.md`, `.github/**` or `electron-builder.yml`. If one of them blocks you, record the reason in the TRACKER agent log and make the smallest fix.
- Never commit `node_modules`, `out`, `dist`, `demo`, `*.db` or editor folders.
- Use the latest stable versions of every package. If `better-sqlite3` has no prebuilt binary for the chosen Electron version and tries to compile from source, lower Electron one major version at a time until a prebuilt binary is used, and record the final versions in the agent log.

## S1. Repository hygiene
Create `.gitignore` (node_modules, out, dist, demo, `*.db`, `*.db-wal`, `*.db-shm`, `.vscode`, `.idea`, `.DS_Store`, `coverage`), `.gitattributes` (`* text=auto eol=lf`), `.editorconfig` (utf-8, lf, 2 spaces), `.nvmrc` containing `22`, `.prettierrc` (`printWidth` 100, double quotes, semicolons, trailing commas `all`), `.prettierignore` (out, dist, node_modules, package-lock.json).

## S2. Scaffold and dependencies
1. Generate a reference project in a temporary folder outside the repository with `npm create @quick-start/electron@latest` (React, TypeScript). Copy only what you need into the repository, then delete the temporary folder. Do not keep template demo code, template assets, `@electron-toolkit/*` packages, `electron-updater` or any dependency not listed below.
2. Install exactly these packages and nothing else:
   - runtime: `better-sqlite3 bcryptjs zod react react-dom react-router-dom @fontsource/fraunces @fontsource/inter @fontsource/courier-prime`
   - dev: `electron electron-vite electron-builder vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom eslint typescript-eslint eslint-plugin-react-hooks prettier tsx @types/better-sqlite3 @types/react @types/react-dom @types/node`
3. Commit `package-lock.json`.

## S3. package.json
Fields: `"name": "stockbill"`, `"version": "0.0.0"`, a one-line `description`, `"author"`, `"main": "./out/main/index.js"`, `"engines": { "node": ">=22" }`, `"private": true`.

Scripts (exact):

| script | command |
|---|---|
| `dev` | `npm run rebuild:electron && electron-vite dev` |
| `dev:web` | Vite dev server for the renderer only (`src/renderer`), no Electron |
| `build` | `electron-vite build` |
| `dist` | `npm run build && electron-builder --publish never` |
| `typecheck` | `tsc --noEmit` for every tsconfig project |
| `lint` | `eslint .` |
| `format` | `prettier --write .` |
| `test` | `npm run rebuild:node && vitest run` |
| `verify` | `npm run typecheck && npm run lint && npm test` |
| `rebuild:node` | `npm rebuild better-sqlite3` |
| `rebuild:electron` | `electron-builder install-app-deps` |
| `seed:demo` | `npm run rebuild:node && tsx scripts/seed-demo.ts` (create `scripts/seed-demo.ts` as a file that prints `Seed runner not implemented yet.` and exits 0) |
| `schema:dump` | `tsx scripts/dump-schema.ts` |

## S4. Configuration files
- `electron.vite.config.ts`: main, preload and renderer builds; renderer root `src/renderer`; aliases `@shared` to `src/shared` (all three targets) and `@` to `src/renderer` (renderer only); `better-sqlite3` externalized in main.
- `tsconfig.json` with references to `tsconfig.node.json` (main, preload, shared, scripts, tests, config files) and `tsconfig.web.json` (renderer and shared). `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`. `import.meta.glob` types available in both.
- `vitest.config.ts` with two projects: `main` (environment node; includes `src/main/**/*.test.ts`, `src/shared/**/*.test.ts`, `scripts/**/*.test.ts`, `tests/**/*.test.ts`) and `renderer` (environment jsdom; includes `src/renderer/**/*.test.{ts,tsx}`; setup file registers `@testing-library/jest-dom`).
- `vite.web.config.ts` for `dev:web` (renderer only, same aliases).
- `eslint.config.js` (flat): `typescript-eslint` recommended, `react-hooks`, and `no-restricted-imports` for `src/renderer/**` forbidding `electron`, `better-sqlite3`, `bcryptjs`, `fs`, `path`, `os`, `crypto`, `child_process`, `net`, `http`, `https` and every `node:*` import, with the message `The renderer must not import Node or Electron modules. Call window.api instead.` Ignore `out`, `dist`, `node_modules`, `demo`.

## S5. Folder layout
Exactly the layout in `AGENTS.md`. Create empty folders that later phases fill with a `.gitkeep`: `src/main/db/repositories`, `src/main/domain`, `src/renderer/components`, `src/renderer/dev/mock`, `scripts/seed`, `tests`.

## S6. Database plumbing
- `src/main/db/connection.ts`: `openDatabase(path)`; runs `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL` (skip for `:memory:`), then migrations.
- `src/main/db/migrate.ts`: reads migrations with `import.meta.glob('./migrations/*.sql', { query: '?raw', import: 'default', eager: true })`, sorts by filename, applies each in its own transaction, records in `schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`. A second run applies nothing.
- `src/main/db/migrations/001_init.sql`: copy the SQL block from `JULES_TASK.md` ("Task P0", section 0c) verbatim.
- `src/main/db/sql.ts`: `escapeLike(term)` escaping `\`, `%` and `_` with a backslash (to be used with `LIKE ? ESCAPE '\'`).
- `scripts/dump-schema.ts`: opens an in-memory database, reads `sqlite_master` (tables and indexes, excluding `sqlite_%` and `schema_migrations`), writes `docs/schema.sql`. Run it once and commit the result.

## S7. IPC contract
- Create `src/shared/ipc/common.ts`, `auth.ts`, `inventory.ts`, `suppliers.ts`, `sales.ts`, `reports.ts` by copying the code blocks from `JULES_TASK.md` ("Shared reference", "IPC contract") verbatim.
- `src/shared/ipc/index.ts`: `export type IpcChannels = AuthChannels & InventoryChannels & SuppliersChannels & SalesChannels & ReportsChannels;` and `export type ChannelName = keyof IpcChannels;`.
- `src/shared/ipc/channels.ts`: `export const CHANNELS = [ ... ] as const` listing every channel name. Add a type-level assertion that `typeof CHANNELS[number]` equals `ChannelName` (compile error if they drift).

## S8. IPC plumbing (main and preload)
- `src/main/domain/errors.ts`: `class DomainError extends Error { code: ErrorCode; fields?: Record<string, string> }`.
- `src/main/session.ts`: `getSession()`, `setSession(s)`, `clearSession()`; in memory; session is `{ userId: number; username: string } | null`.
- `src/main/ipc/handle.ts`:
  - `createHandler(schema, options: { auth: boolean }, fn)` returns `(rawInput, ctx) => Promise<ApiResult<T>>`. It parses input with the zod schema (failure returns `VALIDATION` with `fields` built from zod issues), returns `UNAUTHENTICATED` with `Please sign in.` when `auth` is true and there is no session, calls `fn(input, ctx)` with `ctx = { db, session }`, maps `DomainError` to its code, and maps any other exception to `INTERNAL` with the message `Something went wrong. Please try again.` after `console.error`.
  - `handle(channel, schema, options, fn)` registers it with `ipcMain.handle`.
- `src/main/ipc/index.ts`: `registerAllHandlers(db)` loads every sibling feature file with `import.meta.glob('./*.ts', { eager: true })` (excluding `index.ts` and `handle.ts`); each feature file exports `register(db)`. After registering, for every channel in `CHANNELS` that has no handler, register a fallback that returns `RULE` with `This feature is not built yet.` (auth not required).
- `src/main/ipc/core.ts`: implements `app:getVersion` (unauthenticated, returns `app.getVersion()`) and `auth:status` (unauthenticated: `hasUser` from `SELECT COUNT(*) FROM users`, `signedIn` from the session, `username` from the session, `shopName` from the `settings` table or null).
- `src/preload/index.ts`: exposes `window.api = { invoke(channel, payload) }` through `contextBridge`, typed from `IpcChannels`; `src/preload/index.d.ts` declares the global.
- `src/renderer/api.ts`: `call(channel, payload)` returns `data` or throws `ApiCallError` with `code`, `message`, `fields`.
- `src/main/index.ts`: opens the database at `process.env.STOCKBILL_DB ?? path.join(app.getPath('userData'), 'stockbill.db')`, calls `registerAllHandlers`, creates a window (default 1280x900, minimum 1100x700, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), blocks navigation away from the app and blocks new windows, loads the renderer.

## S9. Renderer shell
- `src/renderer/main.tsx` imports the fonts (`@fontsource/fraunces`, `@fontsource/inter`, `@fontsource/courier-prime`, the weights the design needs: Fraunces 600 and 700, Inter 400, 500 and 600, Courier Prime 400 and 700) and the three style files, then renders `<App />` inside `HashRouter`.
- `src/renderer/styles/tokens.css`: the palette variables from `docs/SPEC.md` section 3, a type scale, a 4px spacing scale, border widths. `base.css`: reset, zero border radius, radial-gradient page background, body typography, focus ring (2px outline in `--red`, offset 2px). `print.css`: hides the navigation and controls (class `no-print`).
- Components (only these three; the rest of the UI kit comes later): `PageFrame({ children })` (2px ink border, soft shadow, 32px margin), `PageHeader({ title, subtitle?, right? })` (serif title about 34px, muted subtitle, 1px ink rule), `NavBar()` (wordmark `StockBill`, links Dashboard, Sales, Inventory, Suppliers, Reports with the active link in red and underlined, username on the right and a `Sign out` button that calls `auth:logout` then navigates to `/login`).
- `src/renderer/App.tsx`: routes `/setup`, `/login`, `/` (Dashboard), `/sales`, `/inventory`, `/suppliers`, `/reports`. Guard from `auth:status`: no user redirects to `/setup`; user but not signed in redirects to `/login`; signed in on `/setup` or `/login` redirects to `/`. Setup and Login render a centered placeholder card with the page name and no `NavBar`; the other five render `NavBar` plus `PageFrame` plus `PageHeader` with the page title and the text `Not built yet.`
- Browser mode: `npm run dev:web` must load the same app. When `window.api` is undefined, install a minimal in-memory stand-in in `src/renderer/dev/mockApi.ts` that answers only `app:getVersion` and `auth:status` (query string `?state=setup|login|signedin`, default `signedin`) and returns the `RULE` message `This feature is not built yet.` for every other channel. Make the stand-in load handlers from `src/renderer/dev/mock/*.ts` with `import.meta.glob` so later phases can add their own files.

## S10. Tests (all must pass)
Main project: `DB: migrations apply once`, `DB: foreign keys are enforced`, `DB: sold_at format is enforced`, `SQL: escapeLike escapes % _ and backslash`, `IPC: rejects invalid input`, `IPC: rejects a missing session`, `IPC: maps DomainError and hides internal errors`, `CONTRACT: CHANNELS lists every channel`. Renderer project: `GUARD: redirects to setup, login or dashboard from auth:status` (mocked `window.api`), `API: call throws ApiCallError on an error result`.

## S11. README and tracker
- `README.md`: what it is (one paragraph), requirements (Node 22), install (`npm ci`), run (`npm run dev` and `npm run dev:web`), test (`npm test`), the native-module note (`rebuild:node` for tests and seed, `rebuild:electron` for the app; `dev` and `test` call them automatically), project layout, scripts table.
- `docs/TRACKER.md`: add a row to the status table `| S | Skeleton (plumbing, configs, contracts) | none | done |` and change the P0 row's "Depends on" to `S`. Tick every P0 task this skeleton completed and leave the rest unticked. Append an agent log entry: date, "S", final Electron and `better-sqlite3` versions, anything unusual.

## S12. Verify and report
Run each of these from a clean state (delete `node_modules`, then `npm ci`) and report the real result of each in the pull request description:
1. `npm run verify`
2. `npm run build`
3. `npm run rebuild:node` and `npm run rebuild:electron` (both succeed, in that order and in the reverse order)
4. `npm run dev:web` (loads in a browser; `?state=setup`, `?state=login` and the default signed-in state show the right placeholder)
5. `npm run dev` (the Electron window opens on the Setup placeholder, the console shows no errors)
6. `npx electron-builder --dir` (produces an unpacked app and the packaged app can still load `better-sqlite3`); if it fails, fix `electron-builder.yml` only as far as needed and say exactly what you changed.

Open a pull request from `chore/skeleton` with the template filled in. Stop there.

## Acceptance checklist
- [ ] Clean clone, `npm ci`, `npm run verify` and `npm run build` pass.
- [ ] No dependency outside the S2 list; `package.json` version is `0.0.0`.
- [ ] `src/shared/ipc/*` matches `JULES_TASK.md` exactly.
- [ ] ESLint rejects a Node import placed in a renderer file (prove it once, then remove the file).
- [ ] No feature logic exists; every unbuilt channel answers `This feature is not built yet.`
- [ ] `docs/schema.sql` exists and matches the migration.
- [ ] No ignored file (`node_modules`, `out`, `dist`) is committed.
- [ ] TRACKER updated.
