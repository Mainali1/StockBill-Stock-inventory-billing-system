# StockBill: agent rules

StockBill is a desktop stock-keeping manager for a shop that sells physical goods. The owner keeps an inventory, records sales per item with an explicit date and time, records invoices received from suppliers, and reads dashboards and reports. It is an academic project that will be defended in a viva, so every line must be understandable, tested and traceable to a requirement.

## Source of truth, in priority order
1. This file
2. `docs/SPEC.md` (requirements with IDs, data model, screens)
3. `JULES_TASK.md` (the detailed task for the current run: exact contracts, messages, tests, acceptance checklist)
4. `docs/TRACKER.md` (phases and task status)
5. `design/*.png` (visual reference only; see "Design references")

If these conflict, follow the higher one and note the conflict in the TRACKER agent log.

## How every task runs
1. Read `docs/TRACKER.md`. Work only on the phase named in the task. Do not touch other phases.
2. For each requirement in the phase, work test-first:
   - commit 1: failing test(s) whose names start with the requirement ID, e.g. `SAL-2: refuses to sell more than stock`
   - commit 2: the implementation that makes them pass
   - commit messages: `test(SAL-2): ...` then `feat(SAL-2): ...`
3. Update `docs/TRACKER.md` in the same pull request: tick finished tasks, set the phase status, and append one short entry to the agent log (what was built, what was decided, anything ambiguous).
4. Before finishing run `npm run verify` (typecheck, lint, tests). Do not finish while it fails.
5. Never leave TODO placeholders, bracketed placeholder text, dead code, or sample data hard-coded in the UI.
6. Pull request title follows the commit format below. Fill in `.github/pull_request_template.md` completely.

## Commit format (drives automatic versioning; do not deviate)
Every commit message is a Conventional Commit: `type(scope): subject`.
- Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `ci`, `build`, `style`, `perf`.
- Scope is a requirement ID (`SAL-2`) or a phase (`P4`).
- `feat` raises the minor version. `fix` raises the patch version. A breaking change is marked `feat!:` or has a `BREAKING CHANGE:` footer and raises the major version. Everything else raises the patch version.
- Subject is imperative, lowercase, no trailing period, under 72 characters.
- One logical change per commit. Test commit first, implementation commit second.

## Stack (fixed)
- Electron, React 18, TypeScript with `strict`
- `electron-vite` for build and dev (build output goes to `out/`)
- `electron-builder` for packaging (configuration in `electron-builder.yml`, output goes to `dist/`)
- SQLite through `better-sqlite3`
- `react-router-dom` with `HashRouter`
- `bcryptjs` for password hashing
- `zod` to validate IPC input
- Vitest for unit tests, Testing Library with jsdom for key screen tests
- Plain CSS with variables. No Tailwind, no component library, no chart library.
- Fonts bundled locally via `@fontsource` (Fraunces, Inter, Courier Prime). The app must run fully offline.
- Node 22 for development and CI. Set `"engines": {"node": ">=22"}` in `package.json`.

## Mandatory institutional rules (violations fail the project)
- **No ORM and no query builder** (no Prisma, Drizzle, Sequelize, Knex, Kysely, TypeORM or similar). Write raw SQL.
- **Every query is a prepared statement with bound parameters.** Never build SQL by concatenating or interpolating user-supplied values. The only permitted dynamic SQL is choosing between fixed, hard-coded fragments (for example a whitelisted ORDER BY column).
- **Passwords are hashed with bcrypt.** Never store, log, or return a plaintext password or a hash to the renderer.
- **Authentication is required** for every IPC handler except the first-run setup check, setup, login, and get-app-version.
- A test must prove injection payloads such as `' OR '1'='1` and `'; DROP TABLE users; --` do not log in or alter data.

## Architecture
```
src/main/        Electron main process
  db/            connection, numbered SQL migrations, one repository file per table group
  domain/        pure functions: money, date helpers, stock rules, report aggregation. No electron or fs imports.
  ipc/           one file per feature; each handler validates input with zod and checks the session
  index.ts
src/preload/     typed contextBridge API
src/renderer/    React app (pages/, components/, styles/)
src/shared/      DTO types and IPC channel names shared by main and renderer
design/          reference screenshots
docs/            SPEC.md, TRACKER.md, schema.sql, diagrams
scripts/         seed-demo runner and scripts/seed/ files (one file per phase, run in filename order)
tests/           repository-level tests (release configuration test lives here)
.github/         workflows and pull request template
electron-builder.yml
```
- Renderer never imports Node, Electron or database code. Use `contextIsolation: true`, `nodeIntegration: false`.
- Keep `src/main/db` and `src/main/domain` importable from plain Node so tests run against `:memory:` databases with the real migrations.
- Multi-table changes (sale save, sale edit or delete, supplier invoice save, supplier payment) run in one SQLite transaction.
- The packaged app stores its database at `path.join(app.getPath('userData'), 'stockbill.db')`. Only `seed:demo` and tests may use another path.
- Migrations are bundled into the build by importing the `.sql` files with Vite's `?raw` suffix (for example `import.meta.glob('./migrations/*.sql', { query: '?raw', import: 'default', eager: true })`). Never read migrations from the file system at runtime, because the packaged app has no source tree.

## Conventions
- Money is an integer number of paisa. Format only at the UI edge with `Intl.NumberFormat('en-IN')`, shown as `Rs. 1,20,000` on cards and `1,20,000.00` in tables.
- Date-times are stored as local-time strings `YYYY-MM-DD HH:MM` (no timezone). The sales screen lets the user pick any date and time, so grouping by day or hour is done with string functions on this format.
- Weeks start on Sunday.
- IDs are integer autoincrement.
- Naming: camelCase in TypeScript, snake_case in SQL.
- All npm scripts must run on Windows, Linux and macOS. No shell-specific syntax in `package.json` scripts (use `cross-env`, `rimraf` or Node scripts when needed).
- Commit `package-lock.json`. CI uses `npm ci`.

## Native module rule
`better-sqlite3` builds for either plain Node (tests) or Electron (the app). Do not rebuild for Electron in `postinstall`. Provide `rebuild:node` and `rebuild:electron` scripts, run `rebuild:node` automatically at the start of `npm test`, and document both in the README. Packaging rebuilds native modules for Electron by itself through `electron-builder`; the `.node` files must stay unpacked from the asar archive (already set in `electron-builder.yml`).

## Required npm scripts
`dev`, `dev:web` (renderer in a browser with the mock API), `build` (electron-vite build), `dist` (build, then `electron-builder --publish never`), `typecheck`, `lint`, `test`, `verify` (typecheck, lint, test), `rebuild:node`, `rebuild:electron`, `seed:demo`. The GitHub workflows call exactly these names. Keep `"version": "0.0.0"` in `package.json`; the release pipeline stamps the real version at build time. Never edit the version by hand.

## Release pipeline (automatic builds and versions)
Provided files, already in the repository: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `electron-builder.yml`, `.github/pull_request_template.md`.
- On every pull request, `ci.yml` runs `npm ci` and `npm run verify` on Ubuntu and Windows.
- On every push to `main` that changes source files, `release.yml` runs verify, computes the next semantic version from the Conventional Commit messages since the last tag, creates the git tag `vX.Y.Z`, builds installers on Windows, Linux and macOS, and attaches them to a GitHub Release with generated notes.
- Version stamping happens inside the build job with `npm version <version> --no-git-tag-version`. The repository never commits a version bump.
- Only the P7 task may change files under `.github/workflows/` or `electron-builder.yml`. Other tasks leave them untouched.
- Installers are unsigned. This is intentional.
- The app shows its version (from `app.getVersion()`) on the Setup and Login cards through the unauthenticated get-app-version handler.

## Design references
`design/` holds seven screenshots of an earlier mock (login, dashboard, billing, inventory, suppliers, reports, users). Use them for visual language only: palette, typography, spacing, stamps, borders, bar style, table style, page frame.
- All numbers, names and rows in them are illustrative. Never copy them into the app.
- Their structure is superseded by `docs/SPEC.md` where different. In particular: there is no customer field, payment method, discount, VAT, hold bill, or receipt printing; the billing screen becomes the Sales screen; the Users screen does not exist; the OWNER ONLY stamp is not used; the Forgot password link is not used.
- If a screenshot named in a task is missing, stop and record that in the TRACKER log.

## UI quality bar
- Every interactive element has a visible keyboard focus style and a hit area of at least 32px.
- Body text contrast is at least 4.5:1 against its background.
- Spacing follows a 4px scale. Related controls align on a shared grid.
- Every screen has designed empty, loading and error states.
- No layout shift when data loads or a panel opens.
- Tab order follows visual order. Forms submit with Enter. Dialogs close with Escape.

## Definition of done for a phase
- All its requirement IDs have passing tests named with the ID.
- The screens match the visual language at 1280x900 and stay usable at 1100x700.
- `npm run verify` passes.
- TRACKER updated.
- Commits follow the commit format.

## Out of scope
Customers, customer history, payment methods, VAT or tax, discounts, receipts or printing of sales, multi-user or roles, password recovery, barcode scanning, backup or restore, stock adjustment screens, Bikram Sambat dates, cloud sync, code signing, auto-update inside the app.
