# Voyager

> To the moon and beyond. AI-powered portfolio intelligence.

Voyager tracks investment portfolios, visualizes allocations, benchmarks against references
(e.g. MSCI World), surfaces rebalancing alerts, and adds a conversational AI layer.

![Voyager dashboard](./docs/dashboard.png)

*The composable dashboard: total return + net-worth goal KPIs, a portfolio-vs-MSCI World
performance chart, current-vs-target allocation drift, and an allocation breakdown — all
drag/resize widgets from the registry. (Mock data shown.)*

## Stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS v4 · Recharts · react-grid-layout ·
Zod · Supabase (Postgres + Auth + RLS) · Drizzle · Anthropic Claude · Resend · Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Stooq / OpenFIGI / Anthropic keys
npm run dev                  # cloud Supabase → http://localhost:3000 (redirects to /dashboard)
```

Then run `supabase/migrations/0001_init.sql` and `0002_isin_name.sql` in your Supabase SQL
editor, sign up at `/signup`, and import a CSV at `/import`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `dev:cloud` | Dev server against hosted Supabase (`.env.local`) |
| `npm run dev:local` | Dev server against a local Supabase stack in Docker (`.env.docker`) |
| `npm run build` | Production build |
| `npm run build:local` | Production build against the local stack |
| `npm run lint` | ESLint (`next lint`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |

### Cloud or local database

Run against hosted Supabase (`npm run dev`) or a fully local Supabase stack in Docker
(`npm run dev:local`) — switching is just an env file, no code changes. "Local" means the
local **Supabase** stack (Postgres + Auth), not a bare Postgres, because auth and the
`auth.users` foreign keys come from Supabase.

**One-time local setup:**

```bash
# 1. Install Docker Desktop (and start it), then the Supabase CLI:
brew install supabase/tap/supabase        # macOS; see supabase.com/docs for other OSes

# 2. From the repo root, boot the local stack and apply migrations:
supabase init                              # once — creates supabase/config.toml
supabase start                            # boots Postgres + Auth in Docker; prints URLs + keys
supabase db reset                         # applies supabase/migrations/* into the local DB

# 3. Point the app at it:
cp .env.docker.example .env.docker         # then paste the values supabase start printed
```

Map the `supabase start` output into `.env.docker`: **API URL** → `NEXT_PUBLIC_SUPABASE_URL`,
**anon key** / **service_role key** → the two key vars, **DB URL** → `DATABASE_URL`. (The S3
storage values aren't used.) Shared keys like `STOOQ_API_KEY` stay in `.env.local` and are
merged in automatically.

```bash
npm run dev:local            # http://localhost:3000, against the local stack
```

Sign up at `/signup`; confirmation emails are caught locally by Inbucket at
http://localhost:54324, and you can browse tables in Supabase Studio at http://localhost:54323.
Local and cloud are separate databases (separate accounts, no sync). `supabase stop` shuts the
stack down. More detail in [`docs/local-database.md`](./docs/local-database.md).

## What's in this skeleton

- **App shell** — sidebar driven entirely by `components/shared/nav-config.ts` (navigation as data),
  collapsible. Warm, editorial theme (Inter + Newsreader) with a light/dark toggle (dark default).
- **Dashboard widget system** — `components/widgets/registry.ts` is the single source of truth.
  Drag/resize grid (`react-grid-layout`), edit/view modes, widget picker. Layout persists to
  `localStorage` as a stand-in until the Supabase tables are wired. Five widgets ship today:
  Total Return, **Net Worth Goal**, Performance Chart (**Portfolio vs MSCI World**),
  **Target vs Current** allocation drift, and Allocation Pie.
- **Trade Republic CSV import** — `lib/import/trade-republic/` (pure, unit-tested):
  semicolon CSV parser, **PII hard-strip via column allowlist**, Zod validation, TR→Voyager type
  mapping, idempotent orchestration. Upload UI at `/import`, API at
  `app/api/import/trade-republic/route.ts`.
- **Finance math** — `lib/finance/drift.ts` (pure functions, exhaustively testable).
- **Database** — `supabase/migrations/0001_init.sql` defines the transaction-ledger schema with
  **RLS on every user-scoped table** and the `(user_id, broker, external_id)` dedup constraint.

### Importing your Trade Republic history

Upload your export at `/import` — it is processed entirely server-side, PII is stripped before
anything is stored, and re-importing the same file is idempotent. A realistic 3-year sample
(monthly MSCI World savings plan + individual stocks, dividends, a sell) lives at
`tests/fixtures/trade-republic-3y-portfolio.csv`; regenerate or tweak it with
`node scripts/gen-sample-csv.mjs`.

### Regenerating the dashboard screenshot

`docs/dashboard.png` is captured with Playwright (Chromium). With the app running:

```bash
npm run build && npx next start -p 3100 &   # or: npm run dev (port 3000)
URL=http://localhost:3100/dashboard npm run screenshot
```

## Wired today

- **Auth + persistence** — Supabase email/password, RLS, Drizzle; import persists to the DB.
- **Live market value** — Stooq prices + ECB FX, ISIN→symbol via curated map → OpenFIGI auto-resolution.
- **Real Portfolio, Transactions, Dashboard, Performance, and Settings pages** — no mock data left.
- **Performance over time** — value vs. net invested, gated on a free `STOOQ_API_KEY`.

## Not yet wired

- AI assistant endpoint (Claude), email alerts (Resend), manual transaction add/edit/delete.
- Benchmark overlay (portfolio vs. MSCI World) and TWR/MWR metrics.
