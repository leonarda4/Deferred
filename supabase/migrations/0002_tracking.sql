create table if not exists public.session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  total_duration_ms int not null default 0,
  long_pause_count int not null default 0,
  advanced_at timestamptz,
  unique (session_id, question_id)
);

create table if not exists public.answer_versions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  version_index int not null,
  body text not null default '',
  duration_ms int not null default 0,
  kind text not null check (kind in ('trash', 'final')),
  created_at timestamptz not null default now()
);

create index if not exists session_questions_session_idx on public.session_questions (session_id);
create index if not exists session_questions_question_idx on public.session_questions (question_id);
create index if not exists answer_versions_session_idx on public.answer_versions (session_id);
create index if not exists answer_versions_question_idx on public.answer_versions (question_id);
create index if not exists answer_versions_kind_idx on public.answer_versions (kind);

alter table public.session_questions enable row level security;
alter table public.answer_versions enable row level security;

create policy "session_questions_select_own"
  on public.session_questions
  for select
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_questions.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "session_questions_insert_own"
  on public.session_questions
  for insert
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_questions.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "session_questions_update_own"
  on public.session_questions
  for update
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_questions.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_questions.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "answer_versions_select_own"
  on public.answer_versions
  for select
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = answer_versions.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "answer_versions_insert_own"
  on public.answer_versions
  for insert
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = answer_versions.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "answer_versions_update_own"
  on public.answer_versions
  for update
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = answer_versions.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = answer_versions.session_id
        and s.user_id = auth.uid()
    )
  );
