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
-- safe to re-run: replaces only this seed lesson and its known vocab-backed steps.

do $$
declare
    has_units_table boolean;
    has_lessons_table boolean;
    has_steps_table boolean;
    has_vocab_table boolean;
    unit_id bigint;
    lesson_id bigint;
    lesson_order integer;
    vocab_rizz_id bigint;
    vocab_cap_id bigint;
    vocab_no_cap_id bigint;
    vocab_bussin_id bigint;
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

    if not has_units_table
       or not has_lessons_table
       or not has_steps_table
       or not has_vocab_table then
        raise notice 'lesson seed skipped: required lesson tables not found';
        return;
    end if;

    delete from public.lesson_steps
    where lesson_id in (
        select id
        from public.lessons
        where description = 'seed_local_basics'
    );

    delete from public.lessons
    where description = 'seed_local_basics';

    insert into public.units (title, slug, description, order_index, created_at, updated_at)
    values ('Slang Foundations', 'slang-foundations', 'seed local lesson unit', 1, now(), now())
    on conflict (order_index) do update
    set title = excluded.title,
        slug = excluded.slug,
        description = excluded.description,
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
        slug,
        description,
        learning_objective,
        estimated_minutes,
        order_index,
        status,
        published_at,
        created_at,
        updated_at
    ) values (
        unit_id,
        'Slang Foundations Sampler',
        'slang-foundations-sampler',
        'seed_local_basics',
        'Practice a few foundational Gen Alpha slang terms in one sample lesson.',
        5,
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

    insert into public.lesson_steps (
        lesson_id,
        order_index,
        step_type,
        vocab_item_id,
        payload,
        created_at,
        updated_at
    ) values
        (
            lesson_id,
            1,
            'TEACH',
            vocab_rizz_id,
            jsonb_build_object(
                'title', 'rizz',
                'body', 'charisma or flirting ability',
                'example', 'He''s got rizz.',
                'partOfSpeech', 'noun'
            ),
            now(),
            now()
        ),
        (
            lesson_id,
            2,
            'QUESTION',
            null,
            jsonb_build_object(
                'questionType', 'MCQ',
                'prompt', 'What does "rizz" mean?',
                'explanation', 'Rizz means charisma, especially in social situations.',
                'choices', jsonb_build_array(
                    jsonb_build_object('id', 1, 'text', 'Charisma or flirting ability', 'orderIndex', 1),
                    jsonb_build_object('id', 2, 'text', 'A type of food', 'orderIndex', 2),
                    jsonb_build_object('id', 3, 'text', 'Being sleepy', 'orderIndex', 3),
                    jsonb_build_object('id', 4, 'text', 'Skipping class', 'orderIndex', 4)
                ),
                'answerKey', jsonb_build_object('choiceId', 1),
                'acceptedAnswers', '[]'::jsonb,
                'matchPairs', '[]'::jsonb
            ),
            now(),
            now()
        ),
        (
            lesson_id,
            3,
            'TEACH',
            vocab_cap_id,
            jsonb_build_object(
                'title', 'cap',
                'body', 'a lie',
                'example', 'That''s cap.',
                'partOfSpeech', 'noun'
            ),
            now(),
            now()
        ),
        (
            lesson_id,
            4,
            'QUESTION',
            null,
            jsonb_build_object(
                'questionType', 'SHORT_ANSWER',
                'prompt', 'Complete the sentence: "No way, that''s ___."',
                'explanation', 'Cap means a lie.',
                'choices', '[]'::jsonb,
                'acceptedAnswers', jsonb_build_array('cap'),
                'matchPairs', '[]'::jsonb
            ),
            now(),
            now()
        ),
        (
            lesson_id,
            5,
            'DIALOGUE',
            null,
            jsonb_build_object(
                'text', 'A: I finished everything in five minutes.\nB: That sounds like cap.'
            ),
            now(),
            now()
        ),
        (
            lesson_id,
            6,
            'TEACH',
            vocab_no_cap_id,
            jsonb_build_object(
                'title', 'no cap',
                'body', 'for real / no lie',
                'example', 'No cap, that was great.',
                'partOfSpeech', 'phrase'
            ),
            now(),
            now()
        ),
        (
            lesson_id,
            7,
            'QUESTION',
            null,
            jsonb_build_object(
                'questionType', 'MCQ',
                'prompt', 'Which phrase means "for real"?',
                'explanation', 'No cap means someone is being honest.',
                'choices', jsonb_build_array(
                    jsonb_build_object('id', 1, 'text', 'no cap', 'orderIndex', 1),
                    jsonb_build_object('id', 2, 'text', 'on read', 'orderIndex', 2),
                    jsonb_build_object('id', 3, 'text', 'ghosting', 'orderIndex', 3),
                    jsonb_build_object('id', 4, 'text', 'mid', 'orderIndex', 4)
                ),
                'answerKey', jsonb_build_object('choiceId', 1),
                'acceptedAnswers', '[]'::jsonb,
                'matchPairs', '[]'::jsonb
            ),
            now(),
            now()
        ),
        (
            lesson_id,
            8,
            'QUESTION',
            null,
            jsonb_build_object(
                'questionType', 'MATCH',
                'prompt', 'Match each term to the correct meaning.',
                'explanation', 'Pair slang terms with their definitions.',
                'choices', '[]'::jsonb,
                'acceptedAnswers', '[]'::jsonb,
                'matchPairs', jsonb_build_array(
                    jsonb_build_object('id', 1, 'left', 'rizz', 'right', 'charisma or flirting ability', 'orderIndex', 1),
                    jsonb_build_object('id', 2, 'left', 'cap', 'right', 'a lie', 'orderIndex', 2),
                    jsonb_build_object('id', 3, 'left', 'no cap', 'right', 'for real / no lie', 'orderIndex', 3)
                )
            ),
            now(),
            now()
        ),
        (
            lesson_id,
            9,
            'TEACH',
            vocab_bussin_id,
            jsonb_build_object(
                'title', 'bussin',
                'body', 'really good, usually for food',
                'example', 'This pizza is bussin.',
                'partOfSpeech', 'adjective'
            ),
            now(),
            now()
        ),
        (
            lesson_id,
            10,
            'QUESTION',
            null,
            jsonb_build_object(
                'questionType', 'MCQ',
                'prompt', 'If a meal is "bussin", it is...',
                'explanation', 'Bussin means really good, commonly used for food.',
                'choices', jsonb_build_array(
                    jsonb_build_object('id', 1, 'text', 'Bland', 'orderIndex', 1),
                    jsonb_build_object('id', 2, 'text', 'Really good', 'orderIndex', 2),
                    jsonb_build_object('id', 3, 'text', 'Undercooked', 'orderIndex', 3),
                    jsonb_build_object('id', 4, 'text', 'Expensive', 'orderIndex', 4)
                ),
                'answerKey', jsonb_build_object('choiceId', 2),
                'acceptedAnswers', '[]'::jsonb,
                'matchPairs', '[]'::jsonb
            ),
            now(),
            now()
        );
end $$;
