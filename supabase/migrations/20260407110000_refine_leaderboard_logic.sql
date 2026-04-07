-- Add best_time_seconds to track personal records per lesson
ALTER TABLE public.user_lesson_progress 
ADD COLUMN IF NOT EXISTS best_time_seconds BIGINT;

-- Backfill best_time_seconds from existing successful attempts if any
UPDATE public.user_lesson_progress p
SET best_time_seconds = (
    SELECT MIN(EXTRACT(EPOCH FROM (submitted_at - started_at)))
    FROM public.lesson_attempts 
    WHERE user_id = p.user_id AND lesson_id = p.lesson_id AND passed = true
);

-- Reset user total_time_seconds to be SUM(best_time_seconds) across unique lessons
UPDATE public.users u
SET 
    total_time_seconds = (
        SELECT COALESCE(SUM(best_time_seconds), 0)
        FROM public.user_lesson_progress
        WHERE user_id = u.id AND best_time_seconds IS NOT NULL
    ),
    completed_lessons_count = (
        SELECT COUNT(*)
        FROM public.user_lesson_progress
        WHERE user_id = u.id AND completed_at IS NOT NULL
    );
