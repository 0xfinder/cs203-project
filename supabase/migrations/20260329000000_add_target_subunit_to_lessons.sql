-- Add target_subunit_id to lessons table to track where approved lessons should add their steps
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS target_subunit_id BIGINT REFERENCES lessons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_target_subunit_id ON lessons(target_subunit_id);
