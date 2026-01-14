create extension if not exists "pgcrypto";

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  prompt text not null,
  order_index int,
  meta jsonb default '{}'::jsonb
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms int,
  left_reason text,
  user_agent text,
  timezone text,
  app_version text
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  current_text text default '',
  submitted_text text,
  updated_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create table if not exists public.trashed_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  trashed_text text not null,
  trashed_at timestamptz not null default now(),
  trash_reason text
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id uuid references public.questions(id),
  user_id uuid not null,
  ts timestamptz not null default now(),
  type text not null,
  data jsonb default '{}'::jsonb
);

create index if not exists events_session_ts_idx on public.events (session_id, ts);
create index if not exists events_question_ts_idx on public.events (question_id, ts);
create index if not exists answers_session_idx on public.answers (session_id);
create index if not exists trashed_answers_session_idx on public.trashed_answers (session_id);
create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at);

alter table public.questions enable row level security;
alter table public.sessions enable row level security;
alter table public.answers enable row level security;
alter table public.trashed_answers enable row level security;
alter table public.events enable row level security;

create policy "questions_select_all"
  on public.questions
  for select
  using (true);

create policy "sessions_select_own"
  on public.sessions
  for select
  using (user_id = auth.uid());

create policy "sessions_insert_own"
  on public.sessions
  for insert
  with check (user_id = auth.uid());

create policy "sessions_update_own"
  on public.sessions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "answers_select_own"
  on public.answers
  for select
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = answers.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "answers_insert_own"
  on public.answers
  for insert
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = answers.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "answers_update_own"
  on public.answers
  for update
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = answers.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = answers.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "trashed_answers_select_own"
  on public.trashed_answers
  for select
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = trashed_answers.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "trashed_answers_insert_own"
  on public.trashed_answers
  for insert
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = trashed_answers.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "trashed_answers_update_own"
  on public.trashed_answers
  for update
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = trashed_answers.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = trashed_answers.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "events_select_own"
  on public.events
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      where s.id = events.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "events_insert_own"
  on public.events
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      where s.id = events.session_id
        and s.user_id = auth.uid()
    )
  );
