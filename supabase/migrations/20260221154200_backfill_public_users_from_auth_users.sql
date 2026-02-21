-- backfills public.users for accounts that existed before the auth trigger.
-- keeps inserts idempotent to support repeated runs safely.

insert into public.users (id, email, role, created_at, updated_at)
select
    auth_user.id,
    auth_user.email,
    'LEARNER',
    coalesce(auth_user.created_at, now()),
    now()
from auth.users as auth_user
left join public.users as app_user on app_user.id = auth_user.id
where app_user.id is null
on conflict (id) do nothing;
