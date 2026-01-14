insert into public.questions (slug, prompt, order_index)
values
  ('q-01', 'What decisions do you delay the longest?', 1),
  ('q-02', 'What would you still do if no one could see the result?', 2),
  ('q-03', 'What do you enjoy that you rarely talk about?', 3),
  ('q-04', 'What do you blame on lack of time?', 4),
  ('q-05', 'What part of yourself do others misunderstand?', 5),
  ('q-06', 'When was the last time you lost track of time?', 6),
  ('q-07', 'What would you try if you knew you would not fail?', 7),
  ('q-08', 'Who are you when nothing is being measured?', 8)
on conflict (slug) do update
set prompt = excluded.prompt,
    order_index = excluded.order_index;
