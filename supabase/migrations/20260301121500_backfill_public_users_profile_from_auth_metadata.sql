-- backfills public.users profile fields from legacy auth.users metadata.
-- keeps existing public.users values as source of truth when already present.

update public.users as app_user
set
    display_name = coalesce(
        nullif(trim(app_user.display_name), ''),
        nullif(
            trim(
                coalesce(
                    auth_user.raw_user_meta_data ->> 'display_name',
                    auth_user.raw_user_meta_data ->> 'full_name',
                    auth_user.raw_user_meta_data ->> 'name'
                )
            ),
            ''
        )
    ),
    bio = coalesce(
        nullif(trim(app_user.bio), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'bio'), '')
    ),
    age = coalesce(
        app_user.age,
        case
            when (auth_user.raw_user_meta_data ->> 'age') ~ '^[0-9]{1,3}$'
                then (auth_user.raw_user_meta_data ->> 'age')::integer
            else null
        end
    ),
    gender = coalesce(
        nullif(trim(app_user.gender), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'gender'), '')
    ),
    avatar_color = coalesce(
        nullif(trim(app_user.avatar_color), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'avatar_color'), '')
    ),
    avatar_path = coalesce(
        nullif(trim(app_user.avatar_path), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'avatar_path'), '')
    )
from auth.users as auth_user
where app_user.id = auth_user.id;
