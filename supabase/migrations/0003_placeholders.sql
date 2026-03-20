create table if not exists public.placeholders (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.placeholders enable row level security;

create policy "placeholders_select_all"
  on public.placeholders
  for select
  using (true);

insert into public.placeholders (content)
values
  ('No one is going to think instead of you...'),
  ('No one is coming to answer this instead of you...'),
  ('Come on, think a little...'),
  ('Use that brain of yours...'),
  ('No AI to think instead of you here...'),
  ('Write something, don''t be scared...');
