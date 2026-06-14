-- ─── ai_conversations ────────────────────────────────────────────────────────
-- One row per assistant conversation. Messages are stored as a JSONB array of
-- AI SDK UIMessages (full history). Scoped to the user; RLS isolates rows.
create table if not exists ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text,
  model_id   text,                                -- last-used model (stable MODEL_REGISTRY key)
  messages   jsonb not null default '[]'::jsonb,  -- UIMessage[]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_updated_idx
  on ai_conversations (user_id, updated_at desc);

alter table ai_conversations enable row level security;
create policy "own ai_conversations" on ai_conversations for all using (auth.uid() = user_id);
