-- lesson schema v2
-- moves lesson question content into lesson_steps.payload jsonb and adds lesson/unit metadata.

create extension if not exists pgcrypto;

alter table if exists public.units
    add column if not exists slug text,
    add column if not exists description text;

with slug_source as (
    select
        id,
        case
            when row_number() over (
                partition by regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')
                order by id
            ) = 1
                then trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'))
            else trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')) || '-' || id
        end as generated_slug
    from public.units
)
update public.units units
set slug = slug_source.generated_slug
from slug_source
where units.id = slug_source.id
  and (units.slug is null or btrim(units.slug) = '');

alter table if exists public.units
    alter column slug set not null;

create unique index if not exists uq_units_slug
    on public.units(slug);

alter table if exists public.lessons
    add column if not exists slug text,
    add column if not exists learning_objective text,
    add column if not exists estimated_minutes integer;

with slug_source as (
    select
        id,
        case
            when row_number() over (
                partition by regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')
                order by id
            ) = 1
                then trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'))
            else trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')) || '-' || id
        end as generated_slug
    from public.lessons
)
update public.lessons lessons
set slug = slug_source.generated_slug
from slug_source
where lessons.id = slug_source.id
  and (lessons.slug is null or btrim(lessons.slug) = '');

alter table if exists public.lessons
    alter column slug set not null;

create unique index if not exists uq_lessons_slug
    on public.lessons(slug);

alter table if exists public.lesson_steps
    add column if not exists payload jsonb;

update public.lesson_steps ls
set payload = jsonb_build_object(
    'title', v.term,
    'body', v.definition,
    'example', v.example_sentence,
    'partOfSpeech', v.part_of_speech
)
from public.vocab_items v
where ls.step_type = 'TEACH'
  and ls.vocab_item_id = v.id
  and (ls.payload is null or ls.payload = '{}'::jsonb);

update public.lesson_steps ls
set payload = jsonb_build_object(
    'text', ls.dialogue_text
)
where ls.step_type = 'DIALOGUE'
  and ls.dialogue_text is not null
  and (ls.payload is null or ls.payload = '{}'::jsonb);

update public.lesson_steps ls
set payload = jsonb_build_object(
    'questionType', q.question_type,
    'prompt', q.prompt,
    'explanation', q.explanation,
    'choices', coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'text', c.text,
                'orderIndex', c.order_index
            )
            order by c.order_index, c.id
        )
        from public.lesson_choices c
        where c.question_id = q.id
    ), '[]'::jsonb),
    'answerKey', case
        when q.question_type = 'MCQ' then (
            select jsonb_build_object('choiceId', c.id)
            from public.lesson_choices c
            where c.question_id = q.id
              and c.is_correct = true
            order by c.order_index, c.id
            limit 1
        )
        else null
    end,
    'acceptedAnswers', coalesce((
        select jsonb_agg(a.answer_text order by a.order_index, a.id)
        from public.lesson_question_cloze_answers a
        where a.question_id = q.id
    ), '[]'::jsonb),
    'matchPairs', coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'left', p.left_text,
                'right', p.right_text,
                'orderIndex', p.order_index
            )
            order by p.order_index, p.id
        )
        from public.lesson_question_match_pairs p
        where p.question_id = q.id
    ), '[]'::jsonb)
)
from public.lesson_questions q
where ls.question_id = q.id
  and ls.step_type = 'QUESTION'
  and (ls.payload is null or ls.payload = '{}'::jsonb);

update public.lesson_steps
set payload = '{}'::jsonb
where payload is null;

alter table if exists public.lesson_steps
    alter column payload set not null;

drop index if exists public.idx_lesson_steps_payload_gin;
create index if not exists idx_lesson_steps_payload_gin
    on public.lesson_steps using gin (payload);

alter table if exists public.lesson_steps
    drop constraint if exists ck_lesson_steps_payload;

alter table if exists public.lesson_steps
    drop constraint if exists ck_lesson_steps_step_type;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'ck_lesson_steps_step_type'
    ) then
        alter table public.lesson_steps
            add constraint ck_lesson_steps_step_type check (
                step_type in ('TEACH', 'QUESTION', 'DIALOGUE', 'RECAP')
            );
    end if;
end
$$;

alter table if exists public.lesson_attempts
    add column if not exists started_at timestamptz,
    add column if not exists submitted_at timestamptz;

update public.lesson_attempts
set started_at = coalesce(started_at, created_at, now()),
    submitted_at = coalesce(submitted_at, created_at, now());

alter table if exists public.lesson_attempts
    alter column started_at set not null,
    alter column submitted_at set not null;

create unique index if not exists uq_lesson_attempts_id_lesson
    on public.lesson_attempts(id, lesson_id);

alter table if exists public.lesson_attempt_results
    add column if not exists lesson_id bigint,
    add column if not exists evaluated_answer jsonb,
    add column if not exists created_at timestamptz not null default now();

update public.lesson_attempt_results lar
set lesson_id = la.lesson_id
from public.lesson_attempts la
where lar.attempt_id = la.id
  and lar.lesson_id is null;

update public.lesson_attempt_results
set submitted_answer = coalesce(submitted_answer, '{}'::jsonb),
    evaluated_answer = coalesce(
        evaluated_answer,
        case
            when correct_answer is null then null
            else jsonb_build_object('text', correct_answer)
        end
    );

alter table if exists public.lesson_attempt_results
    alter column lesson_id set not null,
    alter column submitted_answer set not null;

create unique index if not exists uq_lesson_steps_id_lesson
    on public.lesson_steps(id, lesson_id);

create unique index if not exists uq_lesson_attempt_results_attempt_step
    on public.lesson_attempt_results(attempt_id, lesson_step_id);

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_lesson_attempt_results_attempt_lesson'
    ) then
        alter table public.lesson_attempt_results
            add constraint fk_lesson_attempt_results_attempt_lesson
                foreign key (attempt_id, lesson_id)
                references public.lesson_attempts(id, lesson_id)
                on delete cascade;
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_lesson_attempt_results_step_lesson'
    ) then
        alter table public.lesson_attempt_results
            add constraint fk_lesson_attempt_results_step_lesson
                foreign key (lesson_step_id, lesson_id)
                references public.lesson_steps(id, lesson_id)
                on delete cascade;
    end if;
end
$$;

alter table if exists public.lesson_attempt_results
    drop column if exists correct_answer;

create index if not exists idx_attempt_results_submitted_answer_gin
    on public.lesson_attempt_results using gin (submitted_answer);

alter table if exists public.user_lesson_progress
    add column if not exists last_attempt_at timestamptz;

alter table if exists public.user_vocab_memory
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

create table if not exists public.user_step_events (
    id bigserial primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    lesson_id bigint not null references public.lessons(id) on delete cascade,
    lesson_step_id bigint not null,
    attempt_id bigint,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_user_step_events_step_lesson'
    ) then
        alter table public.user_step_events
            add constraint fk_user_step_events_step_lesson
                foreign key (lesson_step_id, lesson_id)
                references public.lesson_steps(id, lesson_id)
                on delete cascade;
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_user_step_events_attempt_lesson'
    ) then
        alter table public.user_step_events
            add constraint fk_user_step_events_attempt_lesson
                foreign key (attempt_id, lesson_id)
                references public.lesson_attempts(id, lesson_id)
                on delete cascade;
    end if;
end
$$;

alter table if exists public.lesson_steps
    drop column if exists question_id,
    drop column if exists dialogue_text;

drop table if exists public.lesson_choices;
drop table if exists public.lesson_question_cloze_answers;
drop table if exists public.lesson_question_match_pairs;
drop table if exists public.lesson_questions;
