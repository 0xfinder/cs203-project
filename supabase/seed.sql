-- seeds forum questions and answers for local development.
-- safe to re-run: this only replaces rows authored by `seed_%`.

do $$
declare
    has_questions_table boolean;
    has_answers_table boolean;
    has_questions_created_at boolean;
    has_answers_created_at boolean;
begin
    select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = 'questions'
    ) into has_questions_table;

    select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = 'answers'
    ) into has_answers_table;

    if not has_questions_table or not has_answers_table then
        raise notice 'forum seed skipped: public.questions/public.answers not found';
        return;
    end if;

    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public' and table_name = 'questions' and column_name = 'created_at'
    ) into has_questions_created_at;

    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public' and table_name = 'answers' and column_name = 'created_at'
    ) into has_answers_created_at;

    -- clean old seed answers first, then seed questions.
    delete from public.answers
    where author like 'seed_%'
       or question_id in (select id from public.questions where author like 'seed_%');

    delete from public.questions
    where author like 'seed_%';

    if has_questions_created_at and has_answers_created_at then
        with seeded_questions as (
            insert into public.questions (title, content, author, created_at)
            values
                (
                    'What does "locked in" mean in school context?',
                    'I keep seeing people say "I''m locked in for finals". Is it just focus, or something else?',
                    'seed_zoe',
                    now() - interval '2 days'
                ),
                (
                    'How do you use "delulu" without sounding mean?',
                    'My friend jokes with this word a lot. Is it always playful or can it come off rude?',
                    'seed_kai',
                    now() - interval '1 day 20 hours'
                ),
                (
                    'Difference between "cap" and "bait"?',
                    'Both seem like calling something fake. When should I use one vs the other?',
                    'seed_noah',
                    now() - interval '1 day 12 hours'
                ),
                (
                    'Is "touch grass" always an insult?',
                    'Sometimes it looks like a joke, sometimes an attack. How do you read tone here?',
                    'seed_mila',
                    now() - interval '1 day'
                ),
                (
                    'What are "aura points"?',
                    'People say I gained aura points after helping classmates. Is that positive social credit?',
                    'seed_ryan',
                    now() - interval '20 hours'
                ),
                (
                    'When do people say "it''s giving..."?',
                    'I hear this phrase before adjectives all the time. What''s the natural way to use it?',
                    'seed_ava',
                    now() - interval '16 hours'
                ),
                (
                    'How do you reply when someone says "L take"?',
                    'Do you defend your point or just meme back? Need a calm response style.',
                    'seed_luca',
                    now() - interval '10 hours'
                ),
                (
                    'What is a "soft launch" relationship post?',
                    'I saw a hand pic with no face and comments said "soft launch". Why?',
                    'seed_aria',
                    now() - interval '6 hours'
                )
            returning id, title
        )
        insert into public.answers (content, author, question_id, created_at)
        select a.content, a.author, q.id, a.created_at
        from seeded_questions q
        join (
            values
                ('What does "locked in" mean in school context?', 'Mostly means intense focus and discipline for a goal period.', 'seed_evan', now() - interval '1 day 22 hours'),
                ('What does "locked in" mean in school context?', 'Think: distractions off, tunnel vision on.', 'seed_hana', now() - interval '1 day 18 hours'),
                ('How do you use "delulu" without sounding mean?', 'Use it for yourself or close friends who know it is playful.', 'seed_omar', now() - interval '1 day 16 hours'),
                ('How do you use "delulu" without sounding mean?', 'Tone matters. In serious convos, avoid it.', 'seed_ivy', now() - interval '1 day 15 hours'),
                ('Difference between "cap" and "bait"?', 'Cap = lie. Bait = post made to trigger reactions.', 'seed_jules', now() - interval '1 day 10 hours'),
                ('Difference between "cap" and "bait"?', 'You can cap in normal speech, but bait is usually content strategy.', 'seed_nora', now() - interval '1 day 8 hours'),
                ('Is "touch grass" always an insult?', 'Not always. Friends use it as a joke to say "take a break".', 'seed_finn', now() - interval '22 hours'),
                ('Is "touch grass" always an insult?', 'If said aggressively in arguments, yes it can be insulting.', 'seed_lina', now() - interval '21 hours'),
                ('What are "aura points"?', 'Yes, it is positive reputation/vibe points in meme language.', 'seed_mateo', now() - interval '18 hours'),
                ('What are "aura points"?', 'Usually social confidence points after a cool move.', 'seed_sara', now() - interval '17 hours'),
                ('When do people say "it''s giving..."?', 'Use it to describe vibes: "it''s giving final boss energy".', 'seed_ella', now() - interval '14 hours'),
                ('When do people say "it''s giving..."?', 'It means "this reminds me of..." in a dramatic way.', 'seed_rei', now() - interval '13 hours'),
                ('How do you reply when someone says "L take"?', 'Ask them to explain what exactly they disagree with.', 'seed_isaac', now() - interval '8 hours'),
                ('How do you reply when someone says "L take"?', 'You can meme back lightly, then return to your point.', 'seed_dani', now() - interval '7 hours'),
                ('What is a "soft launch" relationship post?', 'It means hinting the relationship without full reveal.', 'seed_niko', now() - interval '4 hours'),
                ('What is a "soft launch" relationship post?', 'Like posting linked hands or silhouette before official reveal.', 'seed_amy', now() - interval '3 hours')
        ) as a(question_title, content, author, created_at)
        on a.question_title = q.title;
    else
        with seeded_questions as (
            insert into public.questions (title, content, author)
            values
                (
                    'What does "locked in" mean in school context?',
                    'I keep seeing people say "I''m locked in for finals". Is it just focus, or something else?',
                    'seed_zoe'
                ),
                (
                    'How do you use "delulu" without sounding mean?',
                    'My friend jokes with this word a lot. Is it always playful or can it come off rude?',
                    'seed_kai'
                ),
                (
                    'Difference between "cap" and "bait"?',
                    'Both seem like calling something fake. When should I use one vs the other?',
                    'seed_noah'
                ),
                (
                    'Is "touch grass" always an insult?',
                    'Sometimes it looks like a joke, sometimes an attack. How do you read tone here?',
                    'seed_mila'
                ),
                (
                    'What are "aura points"?',
                    'People say I gained aura points after helping classmates. Is that positive social credit?',
                    'seed_ryan'
                ),
                (
                    'When do people say "it''s giving..."?',
                    'I hear this phrase before adjectives all the time. What''s the natural way to use it?',
                    'seed_ava'
                ),
                (
                    'How do you reply when someone says "L take"?',
                    'Do you defend your point or just meme back? Need a calm response style.',
                    'seed_luca'
                ),
                (
                    'What is a "soft launch" relationship post?',
                    'I saw a hand pic with no face and comments said "soft launch". Why?',
                    'seed_aria'
                )
            returning id, title
        )
        insert into public.answers (content, author, question_id)
        select a.content, a.author, q.id
        from seeded_questions q
        join (
            values
                ('What does "locked in" mean in school context?', 'Mostly means intense focus and discipline for a goal period.', 'seed_evan'),
                ('What does "locked in" mean in school context?', 'Think: distractions off, tunnel vision on.', 'seed_hana'),
                ('How do you use "delulu" without sounding mean?', 'Use it for yourself or close friends who know it is playful.', 'seed_omar'),
                ('How do you use "delulu" without sounding mean?', 'Tone matters. In serious convos, avoid it.', 'seed_ivy'),
                ('Difference between "cap" and "bait"?', 'Cap = lie. Bait = post made to trigger reactions.', 'seed_jules'),
                ('Difference between "cap" and "bait"?', 'You can cap in normal speech, but bait is usually content strategy.', 'seed_nora'),
                ('Is "touch grass" always an insult?', 'Not always. Friends use it as a joke to say "take a break".', 'seed_finn'),
                ('Is "touch grass" always an insult?', 'If said aggressively in arguments, yes it can be insulting.', 'seed_lina'),
                ('What are "aura points"?', 'Yes, it is positive reputation/vibe points in meme language.', 'seed_mateo'),
                ('What are "aura points"?', 'Usually social confidence points after a cool move.', 'seed_sara'),
                ('When do people say "it''s giving..."?', 'Use it to describe vibes: "it''s giving final boss energy".', 'seed_ella'),
                ('When do people say "it''s giving..."?', 'It means "this reminds me of..." in a dramatic way.', 'seed_rei'),
                ('How do you reply when someone says "L take"?', 'Ask them to explain what exactly they disagree with.', 'seed_isaac'),
                ('How do you reply when someone says "L take"?', 'You can meme back lightly, then return to your point.', 'seed_dani'),
                ('What is a "soft launch" relationship post?', 'It means hinting the relationship without full reveal.', 'seed_niko'),
                ('What is a "soft launch" relationship post?', 'Like posting linked hands or silhouette before official reveal.', 'seed_amy')
        ) as a(question_title, content, author)
        on a.question_title = q.title;
    end if;
end $$;

-- seeds one complete approved lesson flow for local lesson playback testing.
-- safe to re-run: replaces only this seed lesson and its known seed questions.

do $$
declare
    has_units_table boolean;
    has_lessons_table boolean;
    has_steps_table boolean;
    has_vocab_table boolean;
    has_lesson_questions_table boolean;
    has_lesson_choices_table boolean;
    has_lesson_cloze_table boolean;
    has_lesson_match_table boolean;
    unit_id bigint;
    lesson_id bigint;
    lesson_order integer;
    vocab_rizz_id bigint;
    vocab_cap_id bigint;
    vocab_no_cap_id bigint;
    vocab_bussin_id bigint;
    q1_id bigint;
    q2_id bigint;
    q3_id bigint;
    q4_id bigint;
    q5_id bigint;
begin
    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'units'
    ) into has_units_table;

    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'lessons'
    ) into has_lessons_table;

    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'lesson_steps'
    ) into has_steps_table;

    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'vocab_items'
    ) into has_vocab_table;

    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'lesson_questions'
    ) into has_lesson_questions_table;

    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'lesson_choices'
    ) into has_lesson_choices_table;

    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'lesson_question_cloze_answers'
    ) into has_lesson_cloze_table;

    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'lesson_question_match_pairs'
    ) into has_lesson_match_table;

    if not has_units_table
       or not has_lessons_table
       or not has_steps_table
       or not has_vocab_table
       or not has_lesson_questions_table
       or not has_lesson_choices_table
       or not has_lesson_cloze_table
       or not has_lesson_match_table then
        raise notice 'lesson seed skipped: required lesson tables not found';
        return;
    end if;

    delete from public.lesson_steps
    where lesson_id in (
        select id
        from public.lessons
        where title = 'The Basics'
          and description = 'seed_local_basics'
    );

    delete from public.lessons
    where title = 'The Basics'
      and description = 'seed_local_basics';

    delete from public.lesson_questions
    where prompt in (
        'What does "rizz" mean?',
        'Complete the sentence: "No way, that''s ___."',
        'Which phrase means "for real"?',
        'Match each term to the correct meaning.',
        'If a meal is "bussin", it is...'
    );

    insert into public.units (title, order_index, created_at, updated_at)
    values ('internet slang', 1, now(), now())
    on conflict (order_index) do update
    set title = excluded.title,
        updated_at = now();

    select id into unit_id
    from public.units
    where order_index = 1;

    select coalesce(max(order_index), 0) + 1 into lesson_order
    from public.lessons l
    where l.unit_id = unit_id;

    insert into public.lessons (
        unit_id,
        title,
        description,
        order_index,
        status,
        published_at,
        created_at,
        updated_at
    ) values (
        unit_id,
        'The Basics',
        'seed_local_basics',
        lesson_order,
        'APPROVED',
        now(),
        now(),
        now()
    )
    returning id into lesson_id;

    insert into public.vocab_items (term, definition, example_sentence, part_of_speech, created_at, updated_at)
    values (
        'rizz',
        'charisma or flirting ability',
        'He''s got rizz.',
        'noun',
        now(),
        now()
    )
    on conflict (term) do update
    set definition = excluded.definition,
        example_sentence = excluded.example_sentence,
        part_of_speech = excluded.part_of_speech,
        updated_at = now()
    returning id into vocab_rizz_id;

    insert into public.vocab_items (term, definition, example_sentence, part_of_speech, created_at, updated_at)
    values (
        'cap',
        'a lie',
        'That''s cap.',
        'noun',
        now(),
        now()
    )
    on conflict (term) do update
    set definition = excluded.definition,
        example_sentence = excluded.example_sentence,
        part_of_speech = excluded.part_of_speech,
        updated_at = now()
    returning id into vocab_cap_id;

    insert into public.vocab_items (term, definition, example_sentence, part_of_speech, created_at, updated_at)
    values (
        'no cap',
        'for real / no lie',
        'No cap, that was great.',
        'phrase',
        now(),
        now()
    )
    on conflict (term) do update
    set definition = excluded.definition,
        example_sentence = excluded.example_sentence,
        part_of_speech = excluded.part_of_speech,
        updated_at = now()
    returning id into vocab_no_cap_id;

    insert into public.vocab_items (term, definition, example_sentence, part_of_speech, created_at, updated_at)
    values (
        'bussin',
        'really good, usually for food',
        'This pizza is bussin.',
        'adjective',
        now(),
        now()
    )
    on conflict (term) do update
    set definition = excluded.definition,
        example_sentence = excluded.example_sentence,
        part_of_speech = excluded.part_of_speech,
        updated_at = now()
    returning id into vocab_bussin_id;

    insert into public.lesson_questions (question_type, prompt, explanation, created_at, updated_at)
    values (
        'MCQ',
        'What does "rizz" mean?',
        'Rizz means charisma, especially in social situations.',
        now(),
        now()
    )
    returning id into q1_id;

    insert into public.lesson_choices (question_id, text, is_correct, order_index)
    values
        (q1_id, 'Charisma or flirting ability', true, 1),
        (q1_id, 'A type of food', false, 2),
        (q1_id, 'Being sleepy', false, 3),
        (q1_id, 'Skipping class', false, 4);

    insert into public.lesson_questions (question_type, prompt, explanation, created_at, updated_at)
    values (
        'CLOZE',
        'Complete the sentence: "No way, that''s ___."',
        'Cap means a lie.',
        now(),
        now()
    )
    returning id into q2_id;

    insert into public.lesson_question_cloze_answers (question_id, answer_text, order_index)
    values
        (q2_id, 'cap', 1);

    insert into public.lesson_questions (question_type, prompt, explanation, created_at, updated_at)
    values (
        'MCQ',
        'Which phrase means "for real"?',
        'No cap means someone is being honest.',
        now(),
        now()
    )
    returning id into q3_id;

    insert into public.lesson_choices (question_id, text, is_correct, order_index)
    values
        (q3_id, 'no cap', true, 1),
        (q3_id, 'on read', false, 2),
        (q3_id, 'ghosting', false, 3),
        (q3_id, 'mid', false, 4);

    insert into public.lesson_questions (question_type, prompt, explanation, created_at, updated_at)
    values (
        'MATCH',
        'Match each term to the correct meaning.',
        'Pair slang terms with their definitions.',
        now(),
        now()
    )
    returning id into q4_id;

    insert into public.lesson_question_match_pairs (question_id, left_text, right_text, order_index)
    values
        (q4_id, 'rizz', 'charisma or flirting ability', 1),
        (q4_id, 'cap', 'a lie', 2),
        (q4_id, 'no cap', 'for real / no lie', 3);

    insert into public.lesson_questions (question_type, prompt, explanation, created_at, updated_at)
    values (
        'MCQ',
        'If a meal is "bussin", it is...',
        'Bussin means really good, commonly used for food.',
        now(),
        now()
    )
    returning id into q5_id;

    insert into public.lesson_choices (question_id, text, is_correct, order_index)
    values
        (q5_id, 'Bland', false, 1),
        (q5_id, 'Really good', true, 2),
        (q5_id, 'Undercooked', false, 3),
        (q5_id, 'Expensive', false, 4);

    insert into public.lesson_steps (
        lesson_id,
        order_index,
        step_type,
        vocab_item_id,
        question_id,
        dialogue_text,
        created_at,
        updated_at
    ) values
        (lesson_id, 1, 'TEACH', vocab_rizz_id, null, null, now(), now()),
        (lesson_id, 2, 'QUESTION', null, q1_id, null, now(), now()),
        (lesson_id, 3, 'TEACH', vocab_cap_id, null, null, now(), now()),
        (lesson_id, 4, 'QUESTION', null, q2_id, null, now(), now()),
        (lesson_id, 5, 'DIALOGUE', null, null, 'A: I finished everything in five minutes.\nB: That sounds like cap.', now(), now()),
        (lesson_id, 6, 'TEACH', vocab_no_cap_id, null, null, now(), now()),
        (lesson_id, 7, 'QUESTION', null, q3_id, null, now(), now()),
        (lesson_id, 8, 'QUESTION', null, q4_id, null, now(), now()),
        (lesson_id, 9, 'TEACH', vocab_bussin_id, null, null, now(), now()),
        (lesson_id, 10, 'QUESTION', null, q5_id, null, now(), now());
end $$;
