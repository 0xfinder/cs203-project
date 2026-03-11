-- removes unused lesson-v1 artifacts that are no longer referenced by backend code.
-- keeps forum tables (public.questions/public.answers) intact.

drop table if exists public.lesson_vocab;
drop table if exists public.question_vocab;

drop table if exists public.choices;
drop table if exists public.question_cloze_answers;
drop table if exists public.question_match_pairs;
