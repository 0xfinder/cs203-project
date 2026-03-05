-- adds v1 learning schema for units, lessons, steps, attempts, progress, and review memory.

create table if not exists public.units (
    id bigserial primary key,
    title varchar(120) not null unique,
    order_index integer not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.units (title, order_index)
select 'starter unit', 1
where not exists (
    select 1 from public.units where order_index = 1
);

alter table if exists public.lessons
    add column if not exists unit_id bigint,
    add column if not exists description text,
    add column if not exists order_index integer,
    add column if not exists status varchar(32) not null default 'DRAFT',
    add column if not exists created_by uuid,
    add column if not exists reviewed_by uuid,
    add column if not exists review_comment text,
    add column if not exists published_at timestamptz,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

update public.lessons
set unit_id = (select id from public.units where order_index = 1)
where unit_id is null;

update public.lessons
set order_index = numbered.order_index
from (
    select id, row_number() over (order by id asc) as order_index
    from public.lessons
) as numbered
where public.lessons.id = numbered.id
  and public.lessons.order_index is null;

alter table if exists public.lessons
    alter column unit_id set not null,
    alter column order_index set not null;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_lessons_unit'
    ) then
        alter table public.lessons
            add constraint fk_lessons_unit
                foreign key (unit_id) references public.units(id) on delete restrict;
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_lessons_created_by'
    ) then
        alter table public.lessons
            add constraint fk_lessons_created_by
                foreign key (created_by) references public.users(id) on delete set null;
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'fk_lessons_reviewed_by'
    ) then
        alter table public.lessons
            add constraint fk_lessons_reviewed_by
                foreign key (reviewed_by) references public.users(id) on delete set null;
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'ck_lessons_status'
    ) then
        alter table public.lessons
            add constraint ck_lessons_status check (
                status in ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')
            );
    end if;
end
$$;

create unique index if not exists uq_lessons_unit_order
    on public.lessons(unit_id, order_index);

create index if not exists idx_lessons_status
    on public.lessons(status);

create table if not exists public.vocab_items (
    id bigserial primary key,
    term varchar(120) not null unique,
    definition text not null,
    example_sentence text,
    part_of_speech varchar(40),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.lesson_vocab (
    lesson_id bigint not null references public.lessons(id) on delete cascade,
    vocab_item_id bigint not null references public.vocab_items(id) on delete cascade,
    primary key (lesson_id, vocab_item_id)
);

create table if not exists public.questions (
    id bigserial primary key,
    question_type varchar(32) not null,
    prompt text not null,
    explanation text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.choices (
    id bigserial primary key,
    question_id bigint not null references public.questions(id) on delete cascade,
    text text not null,
    is_correct boolean not null,
    order_index integer not null
);

create unique index if not exists uq_choices_question_order
    on public.choices(question_id, order_index);

create table if not exists public.question_cloze_answers (
    id bigserial primary key,
    question_id bigint not null references public.questions(id) on delete cascade,
    answer_text text not null,
    order_index integer not null
);

create unique index if not exists uq_cloze_answers_question_order
    on public.question_cloze_answers(question_id, order_index);

create table if not exists public.question_match_pairs (
    id bigserial primary key,
    question_id bigint not null references public.questions(id) on delete cascade,
    left_text text not null,
    right_text text not null,
    order_index integer not null
);

create unique index if not exists uq_match_pairs_question_order
    on public.question_match_pairs(question_id, order_index);

create table if not exists public.lesson_steps (
    id bigserial primary key,
    lesson_id bigint not null references public.lessons(id) on delete cascade,
    order_index integer not null,
    step_type varchar(32) not null,
    vocab_item_id bigint references public.vocab_items(id) on delete set null,
    question_id bigint references public.questions(id) on delete set null,
    dialogue_text text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_lesson_steps_lesson_order
    on public.lesson_steps(lesson_id, order_index);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'ck_lesson_steps_payload'
    ) then
        alter table public.lesson_steps
            add constraint ck_lesson_steps_payload check (
                (step_type = 'TEACH' and vocab_item_id is not null and question_id is null and dialogue_text is null)
                or (step_type = 'QUESTION' and question_id is not null and vocab_item_id is null and dialogue_text is null)
                or (step_type = 'DIALOGUE' and dialogue_text is not null and vocab_item_id is null and question_id is null)
            );
    end if;
end
$$;

create table if not exists public.lesson_attempts (
    id bigserial primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    lesson_id bigint not null references public.lessons(id) on delete cascade,
    score integer not null,
    total_questions integer not null,
    correct_count integer not null,
    passed boolean not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_lesson_attempts_user_created
    on public.lesson_attempts(user_id, created_at desc);

create table if not exists public.lesson_attempt_results (
    id bigserial primary key,
    attempt_id bigint not null references public.lesson_attempts(id) on delete cascade,
    lesson_step_id bigint not null references public.lesson_steps(id) on delete cascade,
    is_correct boolean not null,
    submitted_answer jsonb,
    correct_answer text,
    explanation text
);

create table if not exists public.user_lesson_progress (
    id bigserial primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    lesson_id bigint not null references public.lessons(id) on delete cascade,
    last_step_id bigint references public.lesson_steps(id) on delete set null,
    best_score integer not null default 0,
    attempt_count integer not null default 0,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, lesson_id)
);

create table if not exists public.user_step_events (
    id bigserial primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    lesson_step_id bigint not null references public.lesson_steps(id) on delete cascade,
    response_json jsonb not null default '{}'::jsonb,
    is_correct boolean,
    created_at timestamptz not null default now()
);

create table if not exists public.user_vocab_memory (
    id bigserial primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    vocab_item_id bigint not null references public.vocab_items(id) on delete cascade,
    strength integer not null default 0,
    correct_streak integer not null default 0,
    last_seen_at timestamptz,
    next_due_at timestamptz not null default now(),
    unique (user_id, vocab_item_id)
);

create index if not exists idx_user_vocab_memory_due
    on public.user_vocab_memory(user_id, next_due_at);
