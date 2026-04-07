-- Add leaderboard tracking columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS current_correct_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_correct_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_time_seconds BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_lessons_count INTEGER DEFAULT 0;

-- Backfill completed_lessons_count and total_time_seconds from existing attempts if any
UPDATE public.users u
SET 
    completed_lessons_count = COALESCE((
        SELECT COUNT(DISTINCT lesson_id) 
        FROM public.lesson_attempts 
        WHERE user_id = u.id AND passed = true
    ), 0),
    total_time_seconds = COALESCE((
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (submitted_at - started_at))), 0)
        FROM public.lesson_attempts 
        WHERE user_id = u.id AND passed = true
    ), 0),
    current_correct_streak = COALESCE(current_correct_streak, 0),
    max_correct_streak = COALESCE(max_correct_streak, 0);
