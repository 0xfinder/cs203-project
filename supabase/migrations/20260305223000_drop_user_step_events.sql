-- removes write-heavy per-step event log now that lesson resume uses user_lesson_progress.

drop table if exists public.user_step_events;
