-- adds app-owned profile columns to public.users.
-- these fields are owned by public.users, not auth.users metadata.

alter table if exists public.users
    add column if not exists bio text,
    add column if not exists age integer,
    add column if not exists gender text,
    add column if not exists avatar_color text,
    add column if not exists avatar_path text;
