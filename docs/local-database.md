# Running against a local database (Docker)

The app can run against either your hosted Supabase project (**cloud**) or a fully
local Supabase stack (**local**, in Docker). Switching is just an env file — no
code changes.

| Command | Talks to | Needs Docker? |
|---|---|---|
| `npm run dev` / `npm run dev:cloud` | hosted Supabase (`.env.local`) | no |
| `npm run dev:local` | local Supabase stack (`.env.docker`) | yes — `supabase start` running |

## How it works

`dev:local` loads `.env.docker` *before* Next starts, so its values take
precedence over `.env.local`. The local file only holds the Supabase URL/keys +
`DATABASE_URL`; shared keys (OpenFIGI, Anthropic, …) stay in `.env.local`
and are merged in. So the same external keys work in both modes.

The Drizzle data layer reads `DATABASE_URL` and doesn't care whether it points at
cloud or local. Auth, RLS, and the `auth.users` foreign keys all come from
Supabase — which is why "local" means the local **Supabase stack**, not a bare
Postgres (a plain Postgres has no auth schema, so migrations and login wouldn't work).

## One-time setup

1. Install Docker and the Supabase CLI (`brew install supabase/tap/supabase`).
2. From the repo root:
   ```bash
   supabase init        # creates supabase/config.toml (once)
   supabase start       # boots Postgres + Auth in Docker; prints URLs + keys
   supabase db reset    # applies supabase/migrations/* into the local DB
   ```
3. Copy `.env.docker.example` → `.env.docker` and paste the values `supabase start`
   printed (API URL, anon key, service_role key, DB URL).
4. `npm run dev:local`.

Local and cloud are separate databases: sign up separately in each, and data
does not sync between them. `supabase stop` shuts the local stack down; data
persists in a Docker volume until `supabase stop --no-backup` or `supabase db reset`.
