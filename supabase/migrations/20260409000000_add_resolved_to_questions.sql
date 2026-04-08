alter table questions
  add column if not exists resolved boolean not null default false,
  add column if not exists resolved_at timestamptz;
