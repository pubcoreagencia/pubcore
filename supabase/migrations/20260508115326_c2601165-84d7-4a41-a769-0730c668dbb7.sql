-- Sessões de expediente (ponto) com persistência completa
create table if not exists public.ponto_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  user_name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'working',
  pauses jsonb not null default '[]'::jsonb,
  total_ms bigint not null default 0,
  productive_ms bigint not null default 0,
  pause_ms bigint not null default 0,
  summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ponto_sessions_owner on public.ponto_sessions(owner_email, started_at desc);

alter table public.ponto_sessions enable row level security;

create policy "ponto_sessions_all_select" on public.ponto_sessions for select using (true);
create policy "ponto_sessions_all_insert" on public.ponto_sessions for insert with check (true);
create policy "ponto_sessions_all_update" on public.ponto_sessions for update using (true) with check (true);
create policy "ponto_sessions_all_delete" on public.ponto_sessions for delete using (true);

create trigger ponto_sessions_set_updated_at
before update on public.ponto_sessions
for each row execute function public.set_updated_at();

-- Log permanente de tarefas concluídas durante uma sessão de ponto
create table if not exists public.ponto_session_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ponto_sessions(id) on delete cascade,
  task_id uuid,
  owner_email text not null,
  user_name text,
  company text not null,
  title text not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ponto_session_tasks_session on public.ponto_session_tasks(session_id);
create index if not exists idx_ponto_session_tasks_owner on public.ponto_session_tasks(owner_email, completed_at desc);

alter table public.ponto_session_tasks enable row level security;

create policy "ponto_session_tasks_all_select" on public.ponto_session_tasks for select using (true);
create policy "ponto_session_tasks_all_insert" on public.ponto_session_tasks for insert with check (true);
create policy "ponto_session_tasks_all_update" on public.ponto_session_tasks for update using (true) with check (true);
create policy "ponto_session_tasks_all_delete" on public.ponto_session_tasks for delete using (true);