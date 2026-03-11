begin;

do $$
declare
    legacy_unit_id bigint;
begin
    select id
    into legacy_unit_id
    from public.units
    where slug = 'legacy-internet-slang';

    if legacy_unit_id is null then
        update public.units
        set title = 'Legacy Internet Slang',
            slug = 'legacy-internet-slang',
            description = 'Archived broad unit kept for historical lesson attempts before the unit-first split.',
            order_index = 99,
            updated_at = now()
        where slug = 'internet-slang'
           or lower(title) = 'internet slang';

        select id
        into legacy_unit_id
        from public.units
        where slug = 'legacy-internet-slang';
    end if;

    insert into public.units (title, slug, description, order_index, created_at, updated_at)
    values
      ('Slang Foundations', 'slang-foundations', 'Core Gen Alpha slang used in everyday chat.', 1, now(), now()),
      ('Internet Culture and Memes', 'internet-culture-and-memes', 'Terms tied to memes, online reactions, and culture references.', 2, now(), now()),
      ('Chat and Social Signals', 'chat-and-social-signals', 'Messaging etiquette, reactions, and social cues online.', 3, now(), now()),
      ('Advanced Slang', 'advanced-slang', 'More niche or advanced slang references and social labels.', 4, now(), now())
    on conflict (slug) do update
    set title = excluded.title,
        description = excluded.description,
        order_index = excluded.order_index,
        updated_at = now();

    update public.lessons
    set unit_id = legacy_unit_id,
        status = 'REJECTED',
        review_comment = 'Archived during the unit-first lesson split into smaller lesson sequences.',
        updated_at = now()
    where title in (
        'The Basics',
        'Slang Master',
        'Internet Culture',
        'Meme Legends',
        'Social Reactions',
        'Messaging Moves'
    );

    update public.lessons
    set unit_id = legacy_unit_id,
        status = 'REJECTED',
        review_comment = 'Archived during the unit-first lesson split; duplicated by newer unit lessons.',
        updated_at = now()
    where title = 'Chat Survival';
end
$$;

with target_units as (
    select id, slug
    from public.units
    where slug in (
        'slang-foundations',
        'internet-culture-and-memes',
        'chat-and-social-signals',
        'advanced-slang'
    )
)
insert into public.lessons (
    unit_id,
    title,
    slug,
    description,
    learning_objective,
    estimated_minutes,
    order_index,
    status,
    published_at,
    created_at,
    updated_at
)
select *
from (
    values
        ((select id from target_units where slug = 'slang-foundations'), 'Rizz and Cap Basics', 'rizz-and-cap-basics', 'Introductory slang for charm and calling out lies.', 'Understand and use rizz, cap, and a simple chat exchange.', 4, 1, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'slang-foundations'), 'No Cap and Bussin', 'no-cap-and-bussin', 'Follow-up basics for sincerity and strong positive reactions.', 'Recognize and apply no cap and bussin in context.', 4, 2, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'slang-foundations'), 'Cringe and Bet', 'cringe-and-bet', 'Read tone and agreement in fast chat.', 'Identify cringe and bet in quick conversational contexts.', 4, 3, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'internet-culture-and-memes'), 'Ratio and Stan', 'ratio-and-stan', 'Core internet culture participation terms.', 'Explain what it means to ratio or stan someone online.', 4, 1, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'internet-culture-and-memes'), 'Sus, Lowkey, and Based', 'sus-lowkey-and-based', 'Interpret intent, subtlety, and approval in online speech.', 'Use sus, lowkey, and based appropriately.', 5, 2, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'internet-culture-and-memes'), 'Skibidi and Ohio', 'skibidi-and-ohio', 'Two meme-heavy references that need context.', 'Recognize meme-based references without overgeneralizing them.', 4, 3, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'internet-culture-and-memes'), 'Era and Vibe Check', 'era-and-vibe-check', 'Talk about moods, phases, and quick social reads.', 'Interpret era and vibe check in realistic examples.', 4, 4, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'chat-and-social-signals'), 'Ghosting and Social Reactions', 'ghosting-and-social-reactions', 'Recognize disappearing acts and social cues in conversation.', 'Explain ghosting and related reactions in chat.', 5, 1, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'chat-and-social-signals'), 'Left on Read and Hard Launch', 'left-on-read-and-hard-launch', 'Interpret message status and public relationship reveals.', 'Understand left on read and hard launch in messaging culture.', 4, 2, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'chat-and-social-signals'), 'Soft Launch, Lurking, and Touch Grass', 'soft-launch-lurking-and-touch-grass', 'Read indirect posting and online behavior cues.', 'Use soft launch, lurking, and touch grass in context.', 5, 3, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'advanced-slang'), 'Gyat and Aura', 'gyat-and-aura', 'Advanced slang around reaction and social presence.', 'Recognize gyat and aura without flattening their nuance.', 4, 1, 'APPROVED', now(), now(), now()),
        ((select id from target_units where slug = 'advanced-slang'), 'Fanum Tax, Delulu, and Sigma', 'fanum-tax-delulu-and-sigma', 'Three common but overloaded advanced slang terms.', 'Use fanum tax, delulu, and sigma accurately.', 5, 2, 'APPROVED', now(), now(), now())
) as rows(unit_id, title, slug, description, learning_objective, estimated_minutes, order_index, status, published_at, created_at, updated_at)
on conflict (slug) do update
set unit_id = excluded.unit_id,
    title = excluded.title,
    description = excluded.description,
    learning_objective = excluded.learning_objective,
    estimated_minutes = excluded.estimated_minutes,
    order_index = excluded.order_index,
    status = excluded.status,
    published_at = excluded.published_at,
    updated_at = now();

create temporary table lesson_split_map (
    old_lesson_title text not null,
    step_start integer not null,
    step_end integer not null,
    new_lesson_slug text not null
) on commit drop;

insert into lesson_split_map (old_lesson_title, step_start, step_end, new_lesson_slug)
values
    ('The Basics', 1, 5, 'rizz-and-cap-basics'),
    ('The Basics', 6, 10, 'no-cap-and-bussin'),
    ('Social Reactions', 1, 5, 'cringe-and-bet'),
    ('Internet Culture', 1, 4, 'ratio-and-stan'),
    ('Internet Culture', 5, 10, 'sus-lowkey-and-based'),
    ('Meme Legends', 1, 4, 'skibidi-and-ohio'),
    ('Meme Legends', 5, 8, 'era-and-vibe-check'),
    ('Social Reactions', 6, 10, 'ghosting-and-social-reactions'),
    ('Messaging Moves', 1, 4, 'left-on-read-and-hard-launch'),
    ('Messaging Moves', 5, 10, 'soft-launch-lurking-and-touch-grass'),
    ('Slang Master', 1, 4, 'gyat-and-aura'),
    ('Slang Master', 5, 10, 'fanum-tax-delulu-and-sigma');

delete from public.lesson_steps
where lesson_id in (
    select id
    from public.lessons
    where slug in (
        select new_lesson_slug
        from lesson_split_map
    )
);

insert into public.lesson_steps (
    lesson_id,
    order_index,
    step_type,
    vocab_item_id,
    payload,
    created_at,
    updated_at
)
select
    new_lessons.id as lesson_id,
    row_number() over (
        partition by new_lessons.id
        order by old_steps.order_index, old_steps.id
    ) as order_index,
    old_steps.step_type,
    old_steps.vocab_item_id,
    old_steps.payload,
    old_steps.created_at,
    now()
from lesson_split_map map
join public.lessons old_lessons
    on old_lessons.title = map.old_lesson_title
join public.lesson_steps old_steps
    on old_steps.lesson_id = old_lessons.id
   and old_steps.order_index between map.step_start and map.step_end
join public.lessons new_lessons
    on new_lessons.slug = map.new_lesson_slug
where old_lessons.status = 'REJECTED';

commit;
