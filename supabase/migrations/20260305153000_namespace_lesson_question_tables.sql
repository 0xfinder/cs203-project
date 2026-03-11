-- creates namespaced lesson question tables and links lesson_steps.question_id to lesson_questions.

create table if not exists public.lesson_questions (
    id bigserial primary key,
    question_type varchar(32) not null,
    prompt text not null,
    explanation text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.lesson_choices (
    id bigserial primary key,
    question_id bigint not null references public.lesson_questions(id) on delete cascade,
    text text not null,
    is_correct boolean not null,
    order_index integer not null
);

create unique index if not exists uq_lesson_choices_question_order
    on public.lesson_choices(question_id, order_index);

create table if not exists public.lesson_question_cloze_answers (
    id bigserial primary key,
    question_id bigint not null references public.lesson_questions(id) on delete cascade,
    answer_text text not null,
    order_index integer not null
);

create unique index if not exists uq_lesson_cloze_answers_question_order
    on public.lesson_question_cloze_answers(question_id, order_index);

create table if not exists public.lesson_question_match_pairs (
    id bigserial primary key,
    question_id bigint not null references public.lesson_questions(id) on delete cascade,
    left_text text not null,
    right_text text not null,
    order_index integer not null
);

create unique index if not exists uq_lesson_match_pairs_question_order
    on public.lesson_question_match_pairs(question_id, order_index);

-- if lesson_steps.question_id has an fk to the forum questions table, drop it and repoint.
do $$
declare
    fk record;
begin
    for fk in (
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'lesson_steps'
          and c.contype = 'f'
          and pg_get_constraintdef(c.oid) like '%(question_id)%'
    ) loop
        execute format('alter table public.lesson_steps drop constraint %I', fk.conname);
    end loop;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'fk_lesson_steps_lesson_question'
    ) then
        alter table public.lesson_steps
            add constraint fk_lesson_steps_lesson_question
                foreign key (question_id) references public.lesson_questions(id) on delete set null;
    end if;
end
$$;
