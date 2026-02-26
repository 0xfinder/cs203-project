-- syncs supabase auth signups into public.users.
-- this is db-level logic, so it is managed in sql instead of jpa.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.users (id, email, role, created_at, updated_at)
    values (new.id, new.email, 'LEARNER', now(), now())
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- sets defaults for app-owned columns when the users table already exists.
do $$
begin
    if to_regclass('public.users') is not null then
        alter table public.users
            alter column role set default 'LEARNER',
            alter column created_at set default now(),
            alter column updated_at set default now();
    end if;
end;
$$;
